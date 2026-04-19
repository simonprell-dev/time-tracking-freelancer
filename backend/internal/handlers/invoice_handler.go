// internal/handlers/invoice_handler.go
package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
	"timetracker/internal/database"
	"timetracker/internal/models"
	"timetracker/internal/utils"

	"github.com/gin-gonic/gin"
)

type InvoiceRequest struct {
	ProjectID    uint   `json:"projectId" binding:"required"`
	StartDate    string `json:"startDate"`
	EndDate      string `json:"endDate"`
	TimeEntryIDs []uint `json:"timeEntryIds"`
	Language     string `json:"language"`
}

type InvoiceEntry struct {
	Date        string  `json:"date"`
	Hours       float64 `json:"hours"`
	Description string  `json:"description,omitempty"`
}

type InvoiceResponse struct {
	ID          uint           `json:"id"`
	Number      string         `json:"number"`
	Status      string         `json:"status"`
	Language    string         `json:"language"`
	ProjectName string         `json:"projectName"`
	StartDate   string         `json:"startDate"`
	EndDate     string         `json:"endDate"`
	TotalHours  float64        `json:"totalHours"`
	HourlyRate  float64        `json:"hourlyRate"`
	TotalAmount float64        `json:"totalAmount"`
	Entries     []InvoiceEntry `json:"entries"`
}

func GenerateInvoice(c *gin.Context) {
	var req InvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := utils.GetUserID(c)
	language := normalizeInvoiceLanguage(req.Language)

	var project models.Project
	if err := database.DB.Where("id = ? AND user_id = ?", req.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var entries []models.TimeEntry
	query := database.DB.Where("project_id = ? AND user_id = ? AND invoice_id IS NULL", req.ProjectID, userID)
	if len(req.TimeEntryIDs) > 0 {
		query = query.Where("id IN ?", req.TimeEntryIDs)
	} else {
		startDate, endDate, ok := parseInvoiceDateRange(c, req.StartDate, req.EndDate)
		if !ok {
			return
		}
		query = query.Where("start_time BETWEEN ? AND ?", startDate, endDate.Add(24*time.Hour))
	}

	if err := query.Order("start_time ASC").Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching time entries"})
		return
	}
	if len(entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No unbilled time entries selected"})
		return
	}

	// Group entries by date
	entriesByDate := make(map[string]float64)
	startDate := entries[0].StartTime
	endDate := entries[0].StartTime
	for _, entry := range entries {
		date := entry.StartTime.Format("2006-01-02")
		entriesByDate[date] += float64(entry.Duration) / 3600 // Convert seconds to hours
		if entry.StartTime.Before(startDate) {
			startDate = entry.StartTime
		}
		if entry.StartTime.After(endDate) {
			endDate = entry.StartTime
		}
	}

	// Create formatted entries
	var formattedEntries []InvoiceEntry
	for date, hours := range entriesByDate {
		formattedEntries = append(formattedEntries, InvoiceEntry{
			Date:  date,
			Hours: hours,
		})
	}
	sort.Slice(formattedEntries, func(i, j int) bool {
		return formattedEntries[i].Date < formattedEntries[j].Date
	})

	// Calculate totals
	var totalHours float64
	for _, hours := range entriesByDate {
		totalHours += hours
	}
	totalAmount := totalHours * project.HourlyRate
	invoiceNumber := generateStoredInvoiceNumber(project.Name)

	invoice := models.Invoice{
		Number:      invoiceNumber,
		Status:      "draft",
		Language:    language,
		ProjectID:   project.ID,
		UserID:      userID,
		StartDate:   startDate,
		EndDate:     endDate,
		TotalHours:  totalHours,
		HourlyRate:  project.HourlyRate,
		TotalAmount: totalAmount,
	}
	if err := database.DB.Create(&invoice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating invoice"})
		return
	}

	entryIDs := make([]uint, 0, len(entries))
	for _, entry := range entries {
		entryIDs = append(entryIDs, entry.ID)
	}
	if err := database.DB.Model(&models.TimeEntry{}).
		Where("id IN ? AND user_id = ?", entryIDs, userID).
		Update("invoice_id", invoice.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error marking time entries as billed"})
		return
	}

	response := InvoiceResponse{
		ID:          invoice.ID,
		Number:      invoice.Number,
		Status:      invoice.Status,
		Language:    invoice.Language,
		ProjectName: project.Name,
		StartDate:   startDate.Format("2006-01-02"),
		EndDate:     endDate.Format("2006-01-02"),
		TotalHours:  totalHours,
		HourlyRate:  project.HourlyRate,
		TotalAmount: totalAmount,
		Entries:     formattedEntries,
	}

	c.JSON(http.StatusOK, response)
}

func GetInvoices(c *gin.Context) {
	userID := utils.GetUserID(c)
	var invoices []models.Invoice
	if err := database.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching invoices"})
		return
	}

	c.JSON(http.StatusOK, invoices)
}

func UpdateInvoiceStatus(c *gin.Context) {
	userID := utils.GetUserID(c)
	invoiceID := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	switch status {
	case "draft", "sent", "paid", "overdue":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice status"})
		return
	}

	var invoice models.Invoice
	if err := database.DB.Where("id = ? AND user_id = ?", invoiceID, userID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	invoice.Status = status
	if err := database.DB.Save(&invoice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating invoice status"})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

func parseInvoiceDateRange(c *gin.Context, startValue string, endValue string) (time.Time, time.Time, bool) {
	startDate, err := time.Parse("2006-01-02", startValue)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date format"})
		return time.Time{}, time.Time{}, false
	}

	endDate, err := time.Parse("2006-01-02", endValue)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date format"})
		return time.Time{}, time.Time{}, false
	}

	return startDate, endDate, true
}

func normalizeInvoiceLanguage(language string) string {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "de", "german", "deutsch":
		return "de"
	default:
		return "en"
	}
}

func generateStoredInvoiceNumber(projectName string) string {
	projectPart := strings.ToUpper(strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return -1
	}, projectName))
	if len(projectPart) > 4 {
		projectPart = projectPart[:4]
	}
	if projectPart == "" {
		projectPart = "WORK"
	}

	return fmt.Sprintf("INV-%s-%s-%d", time.Now().Format("20060102"), projectPart, time.Now().UnixNano()%100000)
}
