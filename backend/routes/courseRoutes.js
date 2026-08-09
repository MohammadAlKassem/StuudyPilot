const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { getCourseTasks, createTask } = require('../controllers/taskController');

const router = express.Router();

router.use(authenticate, authorize('student'));

router.route('/')
  .get(getCourses)
  .post(createCourse);

router.route('/:courseId/tasks')
  .get(getCourseTasks)
  .post(createTask);

router.route('/:id')
  .get(getCourse)
  .put(updateCourse)
  .delete(deleteCourse);

module.exports = router;
