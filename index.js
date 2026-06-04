const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4003;
const DATA_FILE = path.join(__dirname, 'streak.json');

app.use(cors());
app.use(express.json());

function readData() {
	if (!fs.existsSync(DATA_FILE)) {
		return { checkIns: [], streaks: [] };
	}

	const raw = fs.readFileSync(DATA_FILE, 'utf8');
	const data = raw ? JSON.parse(raw) : {};

	return {
		checkIns: Array.isArray(data.checkIns) ? data.checkIns : [],
		streaks: Array.isArray(data.streaks) ? data.streaks : [],
	};
}

function saveData(data) {
	fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getStreak(checkIns, userId, appId) {
	const userCheckIns = checkIns
		.filter((item) => item.userId === userId && item.appId === appId)
		.sort((a, b) => a.date.localeCompare(b.date));

	if (userCheckIns.length === 0) {
		return null;
	}

	let currentStreak = 1;
	let longestStreak = 1;
	let runningStreak = 1;

	for (let i = 1; i < userCheckIns.length; i += 1) {
		const previous = new Date(`${userCheckIns[i - 1].date}T00:00:00.000Z`);
		const current = new Date(`${userCheckIns[i].date}T00:00:00.000Z`);
		const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));

		if (diffDays === 1) {
			runningStreak += 1;
		} else if (diffDays > 1) {
			runningStreak = 1;
		}

		if (runningStreak > longestStreak) {
			longestStreak = runningStreak;
		}
	}

	for (let i = userCheckIns.length - 1; i > 0; i -= 1) {
		const previous = new Date(`${userCheckIns[i - 1].date}T00:00:00.000Z`);
		const current = new Date(`${userCheckIns[i].date}T00:00:00.000Z`);
		const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));

		if (diffDays === 1) {
			currentStreak += 1;
		} else {
			break;
		}
	}

	return {
		id: `${appId}:${userId}`,
		userId,
		appId,
		currentStreak,
		longestStreak,
		lastCheckInDate: userCheckIns[userCheckIns.length - 1].date,
		updatedAt: new Date().toISOString(),
	};
}

app.get('/', (req, res) => {
	res.json({ message: 'streak microservice is running' });
});

app.get('/api/check-ins', (req, res) => {
	const data = readData();
	res.json(data.checkIns);
});

app.post('/api/check-ins', (req, res) => {
	const { userId, appId, date } = req.body;

	if (!userId || !appId || !date) {
		return res
			.status(400)
			.json({ error: 'userId, appId, and date are required' });
	}

	const data = readData();
	const checkIn = {
		id: `${userId}:${date}`,
		userId,
		appId,
		date,
		createdAt: new Date().toISOString(),
	};

	const exists = data.checkIns.find((item) => item.id === checkIn.id);

	if (exists) {
		return res.status(409).json({ error: 'check-in already exists' });
	}

	data.checkIns.push(checkIn);

	const streak = getStreak(data.checkIns, userId, appId);
	const streakIndex = data.streaks.findIndex(
		(item) => item.id === `${appId}:${userId}`,
	);

	if (streakIndex >= 0) {
		data.streaks[streakIndex] = streak;
	} else {
		data.streaks.push(streak);
	}

	saveData(data);
	return res.status(201).json({ checkIn, streak });
});

app.get('/api/streaks', (req, res) => {
	const data = readData();
	res.json(data.streaks);
});

app.get('/api/streaks/:id', (req, res) => {
	const data = readData();
	const streak = data.streaks.find((item) => item.id === req.params.id);

	if (!streak) {
		return res.status(404).json({ error: 'streak not found' });
	}

	return res.json(streak);
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
