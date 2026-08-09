-- Optional classroom data for Microsoft SQL Server.
-- Register student@example.com through the API before running this file.
-- This script does not create users or store password hashes. Create the
-- administrator through the Node seed script: npm run create-admin

USE [StudyPilot];
GO

SET NOCOUNT ON;

DECLARE @sample_email NVARCHAR(150) = N'student@example.com';
DECLARE @sample_user_id INT;
DECLARE @sample_course_id INT;

SELECT TOP (1)
    @sample_user_id = id
FROM dbo.users
WHERE email = @sample_email
  AND role = 'student'
ORDER BY id;

IF @sample_user_id IS NULL
BEGIN
    SELECT N'No rows added: register student@example.com first.' AS sample_data_result;
    RETURN;
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.courses
    WHERE user_id = @sample_user_id
      AND title = N'Web Development'
)
BEGIN
    INSERT INTO dbo.courses
    (
        user_id,
        title
    )
    VALUES
    (
        @sample_user_id,
        N'Web Development'
    );
END;

SELECT TOP (1)
    @sample_course_id = id
FROM dbo.courses
WHERE user_id = @sample_user_id
  AND title = N'Web Development'
ORDER BY id;

IF @sample_course_id IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM dbo.tasks
       WHERE course_id = @sample_course_id
         AND title = N'Build authentication form'
   )
BEGIN
    INSERT INTO dbo.tasks
    (
        course_id,
        title,
        description,
        deadline,
        priority,
        status
    )
    VALUES
    (
        @sample_course_id,
        N'Build authentication form',
        N'Connect the React form to the StudyPilot authentication API.',
        DATEADD(DAY, 7, SYSUTCDATETIME()),
        'high',
        'pending'
    );
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.notes
    WHERE user_id = @sample_user_id
      AND title = N'Exam reminder'
)
BEGIN
    INSERT INTO dbo.notes
    (
        user_id,
        title,
        content
    )
    VALUES
    (
        @sample_user_id,
        N'Exam reminder',
        N'Review chapters 4 and 5 before the next lab.'
    );
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.study_plans
    WHERE user_id = @sample_user_id
      AND subject = N'JavaScript'
      AND topic = N'Promises and async/await'
)
BEGIN
    INSERT INTO dbo.study_plans
    (
        user_id,
        subject,
        topic,
        difficulty,
        available_minutes,
        deadline,
        generated_plan
    )
    VALUES
    (
        @sample_user_id,
        N'JavaScript',
        N'Promises and async/await',
        'hard',
        90,
        DATEADD(DAY, 10, SYSUTCDATETIME()),
        N'Objective: Understand asynchronous JavaScript.' + NCHAR(13) + NCHAR(10)
            + NCHAR(13) + NCHAR(10)
            + N'20 minutes: Review promises.' + NCHAR(13) + NCHAR(10)
            + N'20 minutes: Trace promise chains.' + NCHAR(13) + NCHAR(10)
            + N'25 minutes: Build a small async function.' + NCHAR(13) + NCHAR(10)
            + N'20 minutes: Debug error handling.' + NCHAR(13) + NCHAR(10)
            + N'5 minutes: Review the main ideas.'
    );
END;

SELECT N'Sample data is ready.' AS sample_data_result;
GO
