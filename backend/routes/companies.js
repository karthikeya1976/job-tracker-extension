const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashCompanyName } = require('../utils/normalize');

// POST /api/events — submit an application outcome (opt-in users only)
router.post('/events', (req, res) => {
  const { companyName, appliedAt, respondedAt, outcome, daysToResponse } = req.body;

  if (!companyName || !appliedAt || !outcome) {
    return res.status(400).json({ error: 'companyName, appliedAt, and outcome are required' });
  }

  const companyId = hashCompanyName(companyName);

  db.prepare(`
    INSERT INTO events (company_id, applied_at, responded_at, outcome, days_to_response)
    VALUES (?, ?, ?, ?, ?)
  `).run(companyId, appliedAt, respondedAt || null, outcome, daysToResponse || null);

  res.status(201).json({ ok: true, companyId });
});

// GET /api/companies/:id/rating — get rating for one company
router.get('/companies/:id/rating', (req, res) => {
  const { id } = req.params;
  const rating = calculateRating(id);

  if (!rating) {
    return res.json({ id, score: null, grade: '?', n: 0, message: 'Not enough data' });
  }

  res.json(rating);
});

// GET /api/companies/batch?ids=abc,def — get ratings for multiple companies at once
router.get('/companies/batch', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 50);
  const ratings = ids.map(id => calculateRating(id) || { id, score: null, grade: '?', n: 0 });
  res.json(ratings);
});

function calculateRating(companyId) {
  const events = db.prepare(
    'SELECT * FROM events WHERE company_id = ? AND applied_at < ?'
  ).all(companyId, Date.now() / 1000 - 30 * 86400); // only count apps > 30 days old

  if (events.length < 15) return null; // not enough data

  const n = events.length;
  const responded    = events.filter(e => e.outcome !== 'ghosted' && e.outcome !== 'pending');
  const interviews   = events.filter(e => e.outcome === 'interview' || e.outcome === 'offer');
  const ghosted      = events.filter(e => e.outcome === 'ghosted');
  const avgDays      = responded.length
    ? responded.reduce((sum, e) => sum + (e.days_to_response || 0), 0) / responded.length
    : 30;

  const responseRate  = responded.length / n;
  const ghostingRate  = ghosted.length / n;
  const interviewRate = interviews.length / n;
  const daysScore     = Math.max(0, 1 - avgDays / 30);

  const score = (
    responseRate  * 0.40 +
    (1 - ghostingRate) * 0.30 +
    interviewRate * 0.20 +
    daysScore     * 0.10
  ) * 5;

  const grade = score >= 4.5 ? 'A' : score >= 3.5 ? 'B' : score >= 2.5 ? 'C' : score >= 1.5 ? 'D' : 'F';

  return {
    id: companyId, score: +score.toFixed(2), grade, n,
    responseRate: +responseRate.toFixed(2),
    interviewRate: +interviewRate.toFixed(2),
    avgDays: +avgDays.toFixed(1)
  };
}

module.exports = router;
