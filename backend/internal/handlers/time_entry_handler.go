// internal/handlers/time_entry_handler.go
package handlers

import (
	"net/http"
	"time"
	"timetracker/internal/database"
	"timetracker/internal/models"
	"timetracker/internal/utils"

	"github.com/gin-gonic/gin"
)

type timeEntryRequest struct {
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
	ProjectID uint   `json:"project_id" binding:"required"`
	TaskID    *uint  `json:"task_id"`
}

func CreateTimeEntry(c *gin.Context) {
	var req timeEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry, ok := buildTimeEntry(c, req)
	if !ok {
		return
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating time entry"})
		return
	}

	c.JSON(http.StatusCreated, entry)
}

func GetTimeEntries(c *gin.Context) {
	userID := utils.GetUserID(c)
	projectID := c.Query("project_id")
	unbilled := c.Query("unbilled")
	var entries []models.TimeEntry

	query := database.DB.Where("user_id = ?", userID)
	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if unbilled == "true" {
		query = query.Where("invoice_id IS NULL")
	}

	if err := query.Order("start_time DESC").Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching time entries"})
		return
	}

	c.JSON(http.StatusOK, entries)
}

func GetTimeEntry(c *gin.Context) {
	id := c.Param("id")
	userID := utils.GetUserID(c)
	var entry models.TimeEntry

	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&entry).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Time entry not found"})
		return
	}

	c.JSON(http.StatusOK, entry)
}

func UpdateTimeEntry(c *gin.Context) {
	id := c.Param("id")
	userID := utils.GetUserID(c)

	var existing models.TimeEntry
	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Time entry not found"})
		return
	}

	var req timeEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry, ok := buildTimeEntry(c, req)
	if !ok {
		return
	}
	existing.StartTime = entry.StartTime
	existing.EndTime = entry.EndTime
	existing.Duration = entry.Duration
	existing.ProjectID = entry.ProjectID
	existing.TaskID = entry.TaskID

	if err := database.DB.Save(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating time entry"})
		return
	}

	c.JSON(http.StatusOK, existing)
}

func DeleteTimeEntry(c *gin.Context) {
	id := c.Param("id")
	userID := utils.GetUserID(c)

	if err := database.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&models.TimeEntry{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting time entry"})
		return
	}

	c.Status(http.StatusNoContent)
}

// Continue with other time entry handlers...

func buildTimeEntry(c *gin.Context, req timeEntryRequest) (models.TimeEntry, bool) {
	userID := utils.GetUserID(c)

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start time"})
		return models.TimeEntry{}, false
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end time"})
		return models.TimeEntry{}, false
	}

	if !endTime.After(startTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End time must be after start time"})
		return models.TimeEntry{}, false
	}

	if !projectBelongsToUser(req.ProjectID, userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project not found"})
		return models.TimeEntry{}, false
	}

	taskID := uint(0)
	if req.TaskID != nil {
		taskID = *req.TaskID
		var count int64
		if err := database.DB.Model(&models.Task{}).
			Where("id = ? AND project_id = ? AND user_id = ?", taskID, req.ProjectID, userID).
			Count(&count).Error; err != nil || count == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Task not found for selected project"})
			return models.TimeEntry{}, false
		}
	}

	return models.TimeEntry{
		StartTime: startTime,
		EndTime:   endTime,
		Duration:  endTime.Unix() - startTime.Unix(),
		ProjectID: req.ProjectID,
		TaskID:    taskID,
		UserID:    userID,
	}, true
}
