# Troubleshooting Connection Issues

## Android Emulator Connection Problems

If you're getting `ERR_CONNECTION_TIMED_OUT` errors, try these solutions:

### Solution 1: Use Your Local IP Address (Recommended)

1. Find your computer's local IP address:
   ```bash
   # Linux/Mac
   hostname -I
   # or
   ip addr show | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. Update `mobile-app/App.tsx` line 25 with your IP:
   ```typescript
   return 'http://YOUR_LOCAL_IP:5173';
   ```

3. Make sure Vite is configured with `host: '0.0.0.0'` in `vite.config.ts`

### Solution 2: Check Firewall Settings

Make sure your firewall allows connections on port 5173:

```bash
# Linux (ufw)
sudo ufw allow 5173/tcp

# Or check if port is accessible
netstat -tlnp | grep 5173
```

### Solution 3: Verify Server is Running

1. Check if the server is listening on all interfaces:
   ```bash
   netstat -tlnp | grep 5173
   # Should show: 0.0.0.0:5173
   ```

2. Test from command line:
   ```bash
   curl http://localhost:5173
   curl http://10.150.236.96:5173  # Replace with your IP
   ```

### Solution 4: Android Emulator Network Settings

1. Make sure your Android emulator has internet access
2. Try restarting the emulator
3. Check emulator network settings in Android Studio

### Solution 5: Use ADB Port Forwarding

If nothing else works, you can use ADB port forwarding:

```bash
adb reverse tcp:5173 tcp:5173
```

Then use `http://localhost:5173` in the app.

## Testing the Connection

You can test if the server is accessible by opening the URL in a browser on your computer:
- `http://localhost:5173` - Should work from your computer
- `http://10.150.236.96:5173` - Should work from your computer (replace with your IP)

If both work, the mobile app should be able to connect.

## Current Configuration

- Server is configured to listen on `0.0.0.0:5173` (all interfaces)
- Mobile app is configured to use: `http://10.150.236.96:5173`
- If your IP changes, update `App.tsx` accordingly
