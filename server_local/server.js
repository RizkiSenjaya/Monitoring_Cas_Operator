/**
 * RPM Local Node.js Bridge Server (Express)
 * Purpose: Provides high-speed, READ-ONLY API access to D:\CAS_OPERATOR SQLite databases and snapshots.
 * Run with: npm install express && node server.js
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5002;
const BASE_DIR = 'D:\\CAS_OPERATOR';

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Snapshot endpoint
app.get('/api/historis/snapshot/:idk', (req, res) => {
    const idk = req.params.idk;
    if (idk.length < 6) return res.status(400).send('Invalid IDK');
    const yy = idk.substring(0, 2);
    const mm = idk.substring(2, 4);
    const dd = idk.substring(4, 6);
    const imgPath = path.join(BASE_DIR, 'snapshots', `20${yy}`, mm, dd, `${idk}.jpg`);

    if (fs.existsSync(imgPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(imgPath);
    }
    return res.status(404).send('Snapshot image not found');
});

app.get('/api/system/status', (req, res) => {
    res.json({
        status: 'success',
        server: 'Node.js Express Bridge',
        port: PORT,
        base_dir: BASE_DIR,
        accessible: fs.existsSync(BASE_DIR),
        read_only: true
    });
});

app.listen(PORT, () => {
    console.log(`RPM Node.js Server running on http://127.0.0.1:${PORT}`);
    console.log(`Accessing ${BASE_DIR} in safe read-only mode`);
});
