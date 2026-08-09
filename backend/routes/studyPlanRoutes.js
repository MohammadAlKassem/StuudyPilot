'use strict';

const express = require('express');
const {
  deleteStudyPlan,
  generateAndSaveStudyPlan,
  getStudyPlan,
  listStudyPlans,
} = require('../controllers/studyPlanController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate, authorize('student'));

router.get('/', listStudyPlans);
router.post('/generate', generateAndSaveStudyPlan);
router.get('/:id', getStudyPlan);
router.delete('/:id', deleteStudyPlan);

module.exports = router;
