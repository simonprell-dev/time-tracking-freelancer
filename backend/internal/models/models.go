// internal/models/models.go
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type StringList []string

func (list StringList) Value() (driver.Value, error) {
	if list == nil {
		return "[]", nil
	}

	data, err := json.Marshal(list)
	if err != nil {
		return nil, err
	}

	return string(data), nil
}

func (list *StringList) Scan(value interface{}) error {
	if value == nil {
		*list = StringList{}
		return nil
	}

	var data []byte
	switch typed := value.(type) {
	case []byte:
		data = typed
	case string:
		data = []byte(typed)
	default:
		return fmt.Errorf("unsupported StringList value type %T", value)
	}

	if len(data) == 0 {
		*list = StringList{}
		return nil
	}

	return json.Unmarshal(data, list)
}

type User struct {
	gorm.Model
	Email    string    `gorm:"unique;not null" json:"email"`
	Password string    `json:"-"`
	Projects []Project `json:"projects"`
	Tasks    []Task    `json:"tasks"`
}

type Project struct {
	gorm.Model
	Name          string      `json:"name"`
	Description   string      `json:"description"`
	HourlyRate    float64     `json:"hourly_rate"`
	ClientName    string      `json:"client_name"`
	ClientCompany string      `json:"client_company"`
	ClientAddress string      `json:"client_address"`
	ClientEmail   string      `json:"client_email"`
	UserID        uint        `json:"user_id"`
	TimeEntries   []TimeEntry `json:"time_entries"`
	Tasks         []Task      `json:"tasks"`
}

type TimeEntry struct {
	gorm.Model
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Duration  int64     `json:"duration"` // in seconds
	ProjectID uint      `json:"project_id"`
	TaskID    uint      `json:"task_id"`
	UserID    uint      `json:"user_id"`
	InvoiceID *uint     `json:"invoice_id"`
}

type Task struct {
	gorm.Model
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Status      string      `json:"status"`
	Tags        StringList  `gorm:"type:jsonb" json:"tags"`
	ProjectID   uint        `json:"project_id"`
	UserID      uint        `json:"user_id"`
	TimeEntries []TimeEntry `json:"time_entries"`
}

type Invoice struct {
	gorm.Model
	Number      string      `gorm:"uniqueIndex;not null" json:"number"`
	Status      string      `gorm:"not null;default:'draft'" json:"status"`
	Language    string      `gorm:"not null;default:'en'" json:"language"`
	ProjectID   uint        `json:"project_id"`
	UserID      uint        `json:"user_id"`
	StartDate   time.Time   `json:"start_date"`
	EndDate     time.Time   `json:"end_date"`
	TotalHours  float64     `json:"total_hours"`
	HourlyRate  float64     `json:"hourly_rate"`
	TotalAmount float64     `json:"total_amount"`
	TimeEntries []TimeEntry `json:"time_entries"`
}
