echo -e "${YELLOW}Building the application...${NC}"
npm run build

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/bot-dashboard.service << EOL
[Unit]
Description=Multi-Platform Bot Support Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/src/server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
echo -e "${YELLOW}Enabling and starting service...${NC}"
systemctl daemon-reload
systemctl enable bot-dashboard
systemctl start bot-dashboard

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
systemctl status bot-dashboard --no-pager

# Print success message
echo -e "${GREEN}"
echo "============================================================"
echo "  Installation Complete!"
echo "============================================================"
echo -e "${NC}"
echo "Dashboard URL: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Email: admin@redwan.work"
echo "  Password: Pa\$\$w0rd"
echo ""
echo "IMPORTANT: Please change the default password after first login!"
echo ""
echo "To view logs: journalctl -u bot-dashboard -f"
echo "To restart: systemctl restart bot-dashboard"
echo "To stop: systemctl stop bot-dashboard"