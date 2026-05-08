const express = require('express');
const cors = require('cors');
const path = require('path');
const companiesRouter = require('./routes/companies');
const authRouter = require('./routes/auth');
const applicationsRouter = require('./routes/applications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api', companiesRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

// Root redirect: send browser to login if not authenticated
app.get('/', (_, res) => res.redirect('/login.html'));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
