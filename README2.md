# HDJV Dataflow Diagram (Level 0 - Detailed Context)

```mermaid
flowchart LR
  %% External Actors
  Driver[Driver (Mobile App)]
  Passenger[Passenger (Mobile App)]
  Admin[Admin (Web App)]

  %% Client Apps
  DrivingApp[HDJV-Driving-App
(Expo/React Native)]
  DriverSystem[HDJV-Driver-System
(React Web)]

  %% Backend & Services
  API[Backend API
(HDJV-Driver-Backend)]
  DB[(Database)]
  Storage[(File Storage)]
  FCM[Firebase Cloud Messaging]
  Device[Device Services
(Camera/GPS/Notifications)]

  %% Actors to Apps
  Driver --> DrivingApp
  Passenger --> DrivingApp
  Admin --> DriverSystem

  %% Auth & Accounts
  DrivingApp -->|Login/Register/Password Change| API
  DriverSystem -->|Login/Session| API
  API -->|Verify Credentials/Account Status| DB
  API --> DrivingApp
  API --> DriverSystem

  %% Users Management (Admin)
  DriverSystem -->|Create/Edit/Delete Users| API
  DriverSystem -->|List/Filter Users| API
  API -->|Store Users/Profiles| DB
  API --> DriverSystem

  %% Vehicles Management (Admin)
  DriverSystem -->|Create/Edit/Delete Vehicles| API
  DriverSystem -->|List/Filter Vehicles| API
  API -->|Store Vehicle Records| DB
  API --> DriverSystem

  %% Requests (Passenger)
  Passenger -->|Create Ride Request| DrivingApp
  DrivingApp -->|Create/Fetch Requests| API
  API -->|Store Requests| DB
  API --> DrivingApp

  %% Requests (Admin)
  DriverSystem -->|Fetch/Filter Requests| API
  Admin -->|Accept/Reject/Assign| DriverSystem
  DriverSystem -->|Decide/Assign Request| API
  API -->|Update Request Status/Assignment| DB
  API --> DriverSystem

  %% Trips / Routes (Driver)
  Driver -->|Start/Stop Trip, Log Odometer/Passengers| DrivingApp
  DrivingApp -->|Sync Trip Data| API
  API -->|Store Trips/Routes| DB
  API --> DrivingApp

  %% Trips / Routes (Admin)
  DriverSystem -->|Fetch/Edit/Delete Routes| API
  API -->|Update Trips/Routes| DB
  API --> DriverSystem

  %% Proof Photos
  DrivingApp -->|Capture Photo| Device
  Device -->|Photo + GPS Stamp| DrivingApp
  DrivingApp -->|Upload Proof Photo| API
  API -->|Store Photo Metadata| DB
  API -->|Store Photo File| Storage
  DriverSystem -->|View Proof Photos| API
  API -->|Serve Photo URL| Storage

  %% Notifications
  API -->|Push Notification| FCM
  FCM -->|Device Notification| DrivingApp
  FCM -->|Browser Notification| DriverSystem
  DrivingApp -->|Register Device Token| FCM
  DriverSystem -->|Register Browser Token| FCM
  API -->|Notification Records| DB
  DrivingApp -->|List/Mark Read| API
  DriverSystem -->|List/Mark Read| API

  %% Time Records
  DriverSystem -->|Fetch/Upsert Time Records| API
  API -->|Store Time Records| DB

  %% Reports & Analytics
  DriverSystem -->|Fetch Reports/Stats| API
  API -->|Aggregate Data| DB
  API --> DriverSystem

  %% Preferences
  DrivingApp -->|Update Preferences| API
  DriverSystem -->|Update Preferences| API
  API -->|Store Preferences| DB
```

**Import into app.diagrams.net**
Copy and paste ONLY the Mermaid code below (no ```mermaid fences).

```text
flowchart LR
  %% External Actors
  Driver[Driver (Mobile App)]
  Passenger[Passenger (Mobile App)]
  Admin[Admin (Web App)]

  %% Client Apps
  DrivingApp[HDJV-Driving-App
(Expo/React Native)]
  DriverSystem[HDJV-Driver-System
(React Web)]

  %% Backend & Services
  API[Backend API
(HDJV-Driver-Backend)]
  DB[(Database)]
  Storage[(File Storage)]
  FCM[Firebase Cloud Messaging]
  Device[Device Services
(Camera/GPS/Notifications)]

  %% Actors to Apps
  Driver --> DrivingApp
  Passenger --> DrivingApp
  Admin --> DriverSystem

  %% Auth & Accounts
  DrivingApp -->|Login/Register/Password Change| API
  DriverSystem -->|Login/Session| API
  API -->|Verify Credentials/Account Status| DB
  API --> DrivingApp
  API --> DriverSystem

  %% Users Management (Admin)
  DriverSystem -->|Create/Edit/Delete Users| API
  DriverSystem -->|List/Filter Users| API
  API -->|Store Users/Profiles| DB
  API --> DriverSystem

  %% Vehicles Management (Admin)
  DriverSystem -->|Create/Edit/Delete Vehicles| API
  DriverSystem -->|List/Filter Vehicles| API
  API -->|Store Vehicle Records| DB
  API --> DriverSystem

  %% Requests (Passenger)
  Passenger -->|Create Ride Request| DrivingApp
  DrivingApp -->|Create/Fetch Requests| API
  API -->|Store Requests| DB
  API --> DrivingApp

  %% Requests (Admin)
  DriverSystem -->|Fetch/Filter Requests| API
  Admin -->|Accept/Reject/Assign| DriverSystem
  DriverSystem -->|Decide/Assign Request| API
  API -->|Update Request Status/Assignment| DB
  API --> DriverSystem

  %% Trips / Routes (Driver)
  Driver -->|Start/Stop Trip, Log Odometer/Passengers| DrivingApp
  DrivingApp -->|Sync Trip Data| API
  API -->|Store Trips/Routes| DB
  API --> DrivingApp

  %% Trips / Routes (Admin)
  DriverSystem -->|Fetch/Edit/Delete Routes| API
  API -->|Update Trips/Routes| DB
  API --> DriverSystem

  %% Proof Photos
  DrivingApp -->|Capture Photo| Device
  Device -->|Photo + GPS Stamp| DrivingApp
  DrivingApp -->|Upload Proof Photo| API
  API -->|Store Photo Metadata| DB
  API -->|Store Photo File| Storage
  DriverSystem -->|View Proof Photos| API
  API -->|Serve Photo URL| Storage

  %% Notifications
  API -->|Push Notification| FCM
  FCM -->|Device Notification| DrivingApp
  FCM -->|Browser Notification| DriverSystem
  DrivingApp -->|Register Device Token| FCM
  DriverSystem -->|Register Browser Token| FCM
  API -->|Notification Records| DB
  DrivingApp -->|List/Mark Read| API
  DriverSystem -->|List/Mark Read| API

  %% Time Records
  DriverSystem -->|Fetch/Upsert Time Records| API
  API -->|Store Time Records| DB

  %% Reports & Analytics
  DriverSystem -->|Fetch Reports/Stats| API
  API -->|Aggregate Data| DB
  API --> DriverSystem

  %% Preferences
  DrivingApp -->|Update Preferences| API
  DriverSystem -->|Update Preferences| API
  API -->|Store Preferences| DB
```

# HDJV System Flowchart (Detailed)

```mermaid
flowchart TD
  %% Actors
  Driver[Driver]
  Passenger[Passenger]
  Admin[Admin]

  %% Entry Points
  MobileApp[HDJV-Driving-App]
  WebApp[HDJV-Driver-System]

  %% Backend
  API[Backend API]
  DB[(Database)]
  Storage[(File Storage)]
  FCM[Firebase Cloud Messaging]
  Device[Device Services
(Camera/GPS/Notifications)]

  %% -------- Mobile App (Driving-App) --------
  subgraph MobileApp[HDJV-Driving-App]
    MA_Login[Login Screen]
    MA_Register[Register Screen]
    MA_ForceChange[Force Change Password]
    MA_ChangePwd[Change Password]
    MA_Home[Home (Tabs: Requests/Trips)]
    MA_Profile[Profile]
    MA_RequestNew[Request New]
    MA_RequestDetails[Request Details]
    MA_TripDetails[Trip Details]
    MA_TripLog[Trip Log]
    MA_Notifications[Notifications]
    MA_Proof[Proof Capture/View]

    %% Components used in multiple screens
    C_TripSummary[TripSummaryCard]
    C_Odometer[OdometerSection]
    C_Passengers[PassengersSection]
    C_VehicleType[VehicleTypeSection]
    C_Plate[PlateNumberSection]
    C_ProofPhotos[ProofPhotosSection]
    C_PlateModal[PlateNumberModal]
    C_ConfirmModal[ConfirmationModal]
  end

  Driver --> MA_Login
  Passenger --> MA_Login
  MA_Login -->|Login| API
  MA_Register -->|Register| API
  MA_ForceChange -->|Update Password| API
  MA_ChangePwd -->|Update Password| API

  MA_Login --> MA_Home
  MA_Register --> MA_Login
  MA_ForceChange --> MA_Home

  %% Home (role-based)
  MA_Home -->|Fetch Trips| API
  MA_Home -->|Fetch Requests| API
  MA_Home -->|Fetch Notifications| API
  MA_Home --> MA_RequestNew
  MA_Home --> MA_RequestDetails
  MA_Home --> MA_TripDetails
  MA_Home --> MA_Notifications

  %% Request New
  MA_RequestNew -->|Create Request| API
  MA_RequestNew --> MA_Home

  %% Request Details
  MA_RequestDetails -->|Get Request| API

  %% Trip Details / Trip Log
  MA_TripDetails --> C_TripSummary
  MA_TripDetails --> C_Odometer
  MA_TripDetails --> C_Passengers
  MA_TripDetails --> C_VehicleType
  MA_TripDetails --> C_Plate
  MA_TripDetails --> C_ProofPhotos
  MA_TripDetails --> C_PlateModal
  MA_TripDetails --> C_ConfirmModal
  MA_TripDetails -->|Sync Trip| API
  MA_TripDetails -->|Update Request Status (if assigned)| API

  MA_TripLog --> C_TripSummary
  MA_TripLog --> C_Odometer
  MA_TripLog --> C_Passengers
  MA_TripLog --> C_VehicleType
  MA_TripLog --> C_Plate
  MA_TripLog --> C_ProofPhotos
  MA_TripLog --> C_PlateModal
  MA_TripLog --> C_ConfirmModal
  MA_TripLog -->|Sync Trip| API

  %% Proof Capture
  MA_Proof --> Device
  MA_Proof -->|Upload Proof Photo| API

  %% Notifications
  MA_Notifications -->|List/Mark Read| API
  MA_Profile -->|Update Preferences| API
  MA_Profile -->|Logout| MA_Login

  %% -------- Web App (Driver-System) --------
  subgraph WebApp[HDJV-Driver-System]
    WEB_Login[Login]
    WEB_Dashboard[Dashboard]
    WEB_Users[Users]
    WEB_Vehicles[Vehicles]
    WEB_Accounts[Accounts]
    WEB_Requests[Requests]
    WEB_Routes[Routes]
    WEB_Reports[Reports]
    WEB_TimeRecords[Time Records - Per Driver]
    WEB_TimeRecordsDay[Time Records - Per Day]
    WEB_Settings[Settings]
    WEB_Notifications[Notifications]

    %% Shared components
    C_Sidebar[Sidebar]
    C_Header[Header]
    C_Toast[Toast System]
    C_AddEdit[AddEditModal]
    C_View[ViewModal]
    C_Delete[DeleteConfirmModal]
    C_Assign[AssignDriverModal]
    C_UserCreated[UserCreatedModal]
    C_NotificationPrompt[NotificationPrompt]
  end

  Admin --> WEB_Login
  WEB_Login -->|Login| API
  WEB_Login --> WEB_Dashboard

  %% Layout shared UI
  WEB_Dashboard --> C_Sidebar
  WEB_Dashboard --> C_Header
  WEB_Dashboard --> C_NotificationPrompt

  %% Dashboard
  WEB_Dashboard -->|Fetch Summary Stats| API

  %% Users
  WEB_Users -->|Fetch/List Users| API
  WEB_Users --> C_AddEdit
  WEB_Users --> C_View
  WEB_Users --> C_Delete
  WEB_Users --> C_UserCreated
  WEB_Users -->|Create/Update/Delete User| API

  %% Vehicles
  WEB_Vehicles -->|Fetch/List Vehicles| API
  WEB_Vehicles --> C_AddEdit
  WEB_Vehicles --> C_View
  WEB_Vehicles --> C_Delete
  WEB_Vehicles -->|Create/Update/Delete Vehicle| API

  %% Accounts
  WEB_Accounts -->|Fetch/List Accounts| API
  WEB_Accounts --> C_AddEdit
  WEB_Accounts --> C_Delete
  WEB_Accounts -->|Approve/Toggle Status/Update/Delete| API

  %% Requests
  WEB_Requests -->|Fetch/List Requests| API
  WEB_Requests --> C_View
  WEB_Requests --> C_Delete
  WEB_Requests --> C_Assign
  WEB_Requests -->|Accept/Reject/Assign| API

  %% Routes
  WEB_Routes -->|Fetch/List Trips| API
  WEB_Routes --> C_View
  WEB_Routes --> C_AddEdit
  WEB_Routes --> C_Delete
  WEB_Routes -->|Update/Delete Trip| API

  %% Reports
  WEB_Reports -->|Fetch Trips All/Stats| API

  %% Time Records
  WEB_TimeRecords -->|Fetch/Upsert Records| API
  WEB_TimeRecordsDay -->|Fetch/Upsert Records| API

  %% Settings
  WEB_Settings -->|Update Preferences| API

  %% Web Notifications
  WEB_Notifications -->|List/Mark Read| API
  C_Header -->|Fetch Notifications| API

  %% -------- Backend & Infra --------
  API --> DB
  API --> Storage
  API --> FCM
  FCM --> WEB_Notifications
  FCM --> MA_Notifications

  %% Device Services
  Device --> MA_Proof
```
