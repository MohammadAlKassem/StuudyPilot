-- StudyPilot schema for Microsoft SQL Server Express.
-- This script is non-destructive and can be run repeatedly in SSMS.
-- Existing tables and data are left in place.

SET NOCOUNT ON;

IF DB_ID(N'StudyPilot') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [StudyPilot];');
END;
GO

USE [StudyPilot];
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_users PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL
            CONSTRAINT DF_users_role DEFAULT ('student'),
        is_active BIT NOT NULL
            CONSTRAINT DF_users_is_active DEFAULT (1),
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_users_updated_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT CK_users_role
            CHECK (role IN ('student', 'admin')),
        CONSTRAINT CK_users_name_not_empty
            CHECK (LEN(LTRIM(RTRIM(name))) >= 2),
        CONSTRAINT CK_users_email_not_empty
            CHECK (LEN(LTRIM(RTRIM(email))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.courses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.courses
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_courses PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(100) NOT NULL,
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_courses_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_courses_updated_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_courses_users
            FOREIGN KEY (user_id)
            REFERENCES dbo.users(id)
            ON DELETE CASCADE,
        CONSTRAINT CK_courses_title_not_empty
            CHECK (LEN(LTRIM(RTRIM(title))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.tasks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tasks
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_tasks PRIMARY KEY,
        course_id INT NOT NULL,
        title NVARCHAR(150) NOT NULL,
        description NVARCHAR(MAX) NULL,
        deadline DATETIME2(7) NULL,
        priority VARCHAR(20) NOT NULL
            CONSTRAINT DF_tasks_priority DEFAULT ('medium'),
        status VARCHAR(20) NOT NULL
            CONSTRAINT DF_tasks_status DEFAULT ('pending'),
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_tasks_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_tasks_updated_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_tasks_courses
            FOREIGN KEY (course_id)
            REFERENCES dbo.courses(id)
            ON DELETE CASCADE,
        CONSTRAINT CK_tasks_priority
            CHECK (priority IN ('low', 'medium', 'high')),
        CONSTRAINT CK_tasks_status
            CHECK (status IN ('pending', 'completed')),
        CONSTRAINT CK_tasks_title_not_empty
            CHECK (LEN(LTRIM(RTRIM(title))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.notes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.notes
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_notes PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(150) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_notes_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_notes_updated_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_notes_users
            FOREIGN KEY (user_id)
            REFERENCES dbo.users(id)
            ON DELETE CASCADE,
        CONSTRAINT CK_notes_title_not_empty
            CHECK (LEN(LTRIM(RTRIM(title))) > 0),
        CONSTRAINT CK_notes_content_not_empty
            CHECK (LEN(LTRIM(RTRIM(content))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.study_plans', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.study_plans
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_study_plans PRIMARY KEY,
        user_id INT NOT NULL,
        subject NVARCHAR(100) NOT NULL,
        topic NVARCHAR(150) NOT NULL,
        difficulty VARCHAR(20) NOT NULL
            CONSTRAINT DF_study_plans_difficulty DEFAULT ('medium'),
        available_minutes INT NOT NULL,
        deadline DATETIME2(7) NULL,
        generated_plan NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_study_plans_created_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_study_plans_users
            FOREIGN KEY (user_id)
            REFERENCES dbo.users(id)
            ON DELETE CASCADE,
        CONSTRAINT CK_study_plans_difficulty
            CHECK (difficulty IN ('easy', 'medium', 'hard')),
        CONSTRAINT CK_study_plans_available_minutes
            CHECK (available_minutes >= 15 AND available_minutes <= 480),
        CONSTRAINT CK_study_plans_subject_not_empty
            CHECK (LEN(LTRIM(RTRIM(subject))) > 0),
        CONSTRAINT CK_study_plans_topic_not_empty
            CHECK (LEN(LTRIM(RTRIM(topic))) > 0),
        CONSTRAINT CK_study_plans_generated_plan_not_empty
            CHECK (LEN(LTRIM(RTRIM(generated_plan))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.ai_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_logs
    (
        id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ai_logs PRIMARY KEY,
        user_id INT NOT NULL,
        prompt NVARCHAR(MAX) NOT NULL,
        response NVARCHAR(MAX) NULL,
        status VARCHAR(20) NOT NULL,
        error_message NVARCHAR(500) NULL,
        created_at DATETIME2(7) NOT NULL
            CONSTRAINT DF_ai_logs_created_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_ai_logs_users
            FOREIGN KEY (user_id)
            REFERENCES dbo.users(id)
            ON DELETE CASCADE,
        CONSTRAINT CK_ai_logs_status
            CHECK (status IN ('success', 'failed')),
        CONSTRAINT CK_ai_logs_prompt_not_empty
            CHECK (LEN(LTRIM(RTRIM(prompt))) > 0),
        CONSTRAINT CK_ai_logs_result
            CHECK
            (
                (status = 'success'
                    AND response IS NOT NULL
                    AND LEN(LTRIM(RTRIM(response))) > 0)
                OR
                (status = 'failed'
                    AND error_message IS NOT NULL
                    AND LEN(LTRIM(RTRIM(error_message))) > 0)
            )
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.users')
      AND name = N'idx_users_role_active'
)
BEGIN
    CREATE INDEX idx_users_role_active
        ON dbo.users(role, is_active);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.users')
      AND name = N'idx_users_created_at'
)
BEGIN
    CREATE INDEX idx_users_created_at
        ON dbo.users(created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.courses')
      AND name = N'idx_courses_user_created'
)
BEGIN
    CREATE INDEX idx_courses_user_created
        ON dbo.courses(user_id, created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.tasks')
      AND name = N'idx_tasks_course_status_deadline'
)
BEGIN
    CREATE INDEX idx_tasks_course_status_deadline
        ON dbo.tasks(course_id, status, deadline);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.tasks')
      AND name = N'idx_tasks_created_at'
)
BEGIN
    CREATE INDEX idx_tasks_created_at
        ON dbo.tasks(created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.notes')
      AND name = N'idx_notes_user_created'
)
BEGIN
    CREATE INDEX idx_notes_user_created
        ON dbo.notes(user_id, created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.study_plans')
      AND name = N'idx_study_plans_user_created'
)
BEGIN
    CREATE INDEX idx_study_plans_user_created
        ON dbo.study_plans(user_id, created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.study_plans')
      AND name = N'idx_study_plans_deadline'
)
BEGIN
    CREATE INDEX idx_study_plans_deadline
        ON dbo.study_plans(deadline);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ai_logs')
      AND name = N'idx_ai_logs_user_created'
)
BEGIN
    CREATE INDEX idx_ai_logs_user_created
        ON dbo.ai_logs(user_id, created_at);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ai_logs')
      AND name = N'idx_ai_logs_status_created'
)
BEGIN
    CREATE INDEX idx_ai_logs_status_created
        ON dbo.ai_logs(status, created_at);
END;
GO
