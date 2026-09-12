# Zentime Backend VPS Deploy Package

Files in this folder:

- `application.jar` - latest backend JAR build.
- `.env.example` - copy to `.env` on the VPS and fill real values.
- `start.sh` - simple Linux start script.
- `zentime-backend.service` - optional systemd service template.

Suggested VPS path:

```bash
/opt/zentime/backend
```

Basic setup:

```bash
sudo mkdir -p /opt/zentime/backend/uploads
sudo cp application.jar /opt/zentime/backend/application.jar
sudo cp .env.example /opt/zentime/backend/.env
sudo nano /opt/zentime/backend/.env
sudo chown -R zentime:zentime /opt/zentime/backend
```

Run manually:

```bash
cd /opt/zentime/backend
chmod +x start.sh
./start.sh
```

Run with systemd:

```bash
sudo cp zentime-backend.service /etc/systemd/system/zentime-backend.service
sudo systemctl daemon-reload
sudo systemctl enable zentime-backend
sudo systemctl restart zentime-backend
sudo journalctl -u zentime-backend -f
```

Important:

- Do not put production DB credentials in Git.
- `DB_URL` must start with `jdbc:mysql://`.
- Configure Nginx/SSL separately to proxy public HTTPS traffic to backend port `5000`.
- This package does not deploy automatically.
