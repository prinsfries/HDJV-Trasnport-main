<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HDJV Driver API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }
        .api-info {
            background: #e8f4fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
        }
        .endpoint {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>HDJV Driver API</h1>
        <p>Welcome to the HDJV Driver System API backend.</p>
        
        <div class="api-info">
            <strong>This is a RESTful API server for the HDJV Driver mobile application.</strong>
        </div>
        
        <h3>Available Endpoints:</h3>
        <div class="endpoint">POST /api/login - User authentication</div>
        <div class="endpoint">GET /api/user - Get current user info</div>
        <div class="endpoint">GET /api/trips - Get trips list</div>
        <div class="endpoint">POST /api/trips - Create new trip</div>
        <div class="endpoint">PUT /api/trips/{id} - Update trip</div>
        
        <p><strong>Status:</strong> 🟢 API Server Running</p>
        <p><strong>Version:</strong> 1.0.0</p>
    </div>
</body>
</html>
