const express = require('express');
const cors = require('cors');
const companiesRouter = require('./routes/companies');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', companiesRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Ratings API running on http://localhost:${PORT}`));
