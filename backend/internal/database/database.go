// internal/database/database.go
package database

import (
	"log"
	"timetracker/internal/config"
	"timetracker/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() *gorm.DB {
	var err error
	DB, err = gorm.Open(postgres.Open(config.AppConfig.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	migrateTaskTagsToJSON()

	// Auto migrate the schema
	if err := DB.AutoMigrate(&models.User{}, &models.Project{}, &models.TimeEntry{}, &models.Invoice{}); err != nil {
		log.Printf("Failed to auto migrate base schema: %v", err)
	}
	if err := DB.AutoMigrate(&models.Task{}); err != nil {
		log.Printf("Failed to auto migrate task schema before tag migration: %v", err)
	}
	if err := DB.AutoMigrate(&models.Task{}); err != nil {
		log.Printf("Failed to auto migrate task schema after tag migration: %v", err)
	}

	return DB
}

func migrateTaskTagsToJSON() {
	var dataType string
	err := DB.Raw(`
		SELECT data_type
		FROM information_schema.columns
		WHERE table_name = 'tasks' AND column_name = 'tags'
	`).Scan(&dataType).Error
	if err != nil || dataType != "ARRAY" {
		return
	}

	if err := DB.Exec(`
		ALTER TABLE tasks
		ALTER COLUMN tags TYPE jsonb
		USING COALESCE(to_jsonb(tags), '[]'::jsonb)
	`).Error; err != nil {
		log.Printf("Failed to migrate task tags to jsonb: %v", err)
	}
}
