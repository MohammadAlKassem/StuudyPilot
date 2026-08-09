'use strict';

const express = require('express');
const {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} = require('../controllers/noteController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate, authorize('student'));

router.route('/')
  .get(listNotes)
  .post(createNote);

router.route('/:id')
  .get(getNote)
  .put(updateNote)
  .delete(deleteNote);

module.exports = router;
