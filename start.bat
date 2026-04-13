@echo off
echo Starting HDJV Driver System...
echo.
echo Starting Laravel Backend...
start "Laravel Backend" cmd /k "cd HDJV-Driver-Backend && php artisan serve --host 0.0.0.0 --port 8000"
echo.
echo Starting React Frontend 1...
start "React Frontend 1 (HRMS)" cmd /k "cd HDJV-Driver-System && npm run dev -- --host"
echo.
echo Starting React Native Frontend 1...
start "React Frontend 2 (Mobile App)" cmd /k "cd HDJV-Driving-App && npx expo start -c"
echo.

echo All services are starting...
echo Backend will be available at: http://localhost:8000
echo Frontend 1 (Admin) will be available at: http://localhost:5173
echo Frontend 2 (Mobile App) will be available at: http://localhost:8081
echo.
pause
