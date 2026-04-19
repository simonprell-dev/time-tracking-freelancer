// internal/handlers/task_handler.go
package handlers

import (
	"net/http"
	"timetracker/internal/database"
	"timetracker/internal/models"
	"timetracker/internal/utils"

	"github.com/gin-gonic/gin"
)

type taskRequest struct {
	Title       string            `json:"title" binding:"required"`
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Tags        models.StringList `json:"tags"`
	ProjectID   uint              `json:"project_id" binding:"required"`
}

func GetTasks(c *gin.Context) {
	userID := utils.GetUserID(c)
	projectID := c.Query("project_id")

	query := database.DB.Where("user_id = ?", userID)
	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}

	var tasks []models.Task
	if err := query.Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching tasks"})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func GetTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := utils.GetUserID(c)

	var task models.Task
	if err := database.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, task)
}

func CreateTask(c *gin.Context) {
	var req taskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := utils.GetUserID(c)
	if !projectBelongsToUser(req.ProjectID, userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project not found"})
		return
	}

	status := req.Status
	if status == "" {
		status = "TODO"
	}

	task := models.Task{
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
		Tags:        req.Tags,
		ProjectID:   req.ProjectID,
		UserID:      userID,
	}
	task.UserID = utils.GetUserID(c)

	if err := database.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating task"})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func UpdateTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := utils.GetUserID(c)

	var task models.Task
	if err := database.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var updates taskRequest
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !projectBelongsToUser(updates.ProjectID, userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project not found"})
		return
	}

	task.Title = updates.Title
	task.Description = updates.Description
	task.Status = updates.Status
	task.Tags = updates.Tags
	task.ProjectID = updates.ProjectID

	if err := database.DB.Save(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating task"})
		return
	}

	c.JSON(http.StatusOK, task)
}

func DeleteTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := utils.GetUserID(c)

	result := database.DB.Where("id = ? AND user_id = ?", taskID, userID).Delete(&models.Task{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting task"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

func projectBelongsToUser(projectID uint, userID uint) bool {
	var count int64
	if err := database.DB.Model(&models.Project{}).
		Where("id = ? AND user_id = ?", projectID, userID).
		Count(&count).Error; err != nil {
		return false
	}

	return count > 0
}
