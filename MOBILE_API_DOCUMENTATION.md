# Mobile Application API Documentation

This document provides comprehensive documentation for all APIs available for building mobile applications (Android/iOS) that integrate with the MY AHC Control Panel.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL](#base-url)
3. [API Endpoints](#api-endpoints)
   - [User Management](#user-management)
   - [Weight Logs](#weight-logs)
   - [Medication Logs](#medication-logs)
   - [Blogs](#blogs)
   - [Medicines](#medicines)
   - [Medicine Categories](#medicine-categories)
   - [WooCommerce Integration](#woocommerce-integration)
   - [FAQs](#faqs)
4. [Error Handling](#error-handling)
5. [Best Practices](#best-practices)
6. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require authentication using an API key. The API key must be included in every request.

### API Key Format

API keys must start with the prefix: `ahc_live_sk_`

Example: `ahc_live_sk_abc123xyz789...`

### Authentication Methods

You can send the API key using either of these methods:

#### Method 1: X-API-Key Header (Recommended)
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

#### Method 2: Authorization Bearer Header
```http
Authorization: Bearer ahc_live_sk_your_api_key_here
```

### Getting an API Key

API keys are generated and managed through the admin dashboard at `/dashboard/settings/api-keys`. Only administrators can create and manage API keys.

---

## Base URL

All API endpoints are relative to your deployment URL:

**Production:** `https://your-domain.com/api`

**Development:** `http://localhost:3000/api`

---

## API Endpoints

### User Management

#### 1. Register User

Register a new user or retrieve existing user data when a user logs into the mobile app.

**Endpoint:** `POST /api/app-users/register`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "wpUserId": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "displayName": "John",
  "phone": "+1234567890",
  "age": 30,
  "height": "5'10\"",
  "weight": "180",
  "goal": "170",
  "initialWeight": "185",
  "weightSet": true
}
```

**Required Fields:**
- `wpUserId` (string): WordPress user ID
- `email` (string): User email address

**Optional Fields:**
- `name` (string): User's full name
- `displayName` (string): User's display name
- `phone` (string): Phone number
- `age` (number): User's age
- `height` (string): User's height
- `weight` (string): Current weight in lbs
- `goal` (string): Goal weight in lbs
- `initialWeight` (string): Initial weight when user started
- `weightSet` (boolean): Whether weight data has been set

**Response (201 Created - New User):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "clx123abc",
    "wpUserId": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "displayName": "John",
    "phone": "+1234567890",
    "age": 30,
    "height": "5'10\"",
    "weight": "180",
    "goal": "170",
    "initialWeight": "185",
    "weightSet": true,
    "status": "Active",
    "lastLoginAt": "2024-01-15T10:30:00.000Z",
    "lastLoginIp": "192.168.1.1",
    "loginCount": 1,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (200 OK - Existing User):**
```json
{
  "success": true,
  "message": "User already registered. Returning existing user data.",
  "user": {
    "id": "clx123abc",
    "wpUserId": "123",
    "email": "user@example.com",
    ...
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing API key
- `409 Conflict`: User with this email already exists (duplicate registration attempt)

**Important Notes:**
- If a user with the same email already exists, registration is rejected with a 409 error
- If a user with the same `wpUserId` already exists, the existing user data is returned and login tracking is updated
- This endpoint should be called when a user successfully logs into the mobile app

---

#### 2. Get User

Retrieve user data by WordPress user ID or email.

**Endpoint:** `GET /api/app-users/get`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `wpUserId` (string, optional): WordPress user ID
- `email` (string, optional): User email address

**Note:** At least one of `wpUserId` or `email` must be provided.

**Example Request:**
```http
GET /api/app-users/get?wpUserId=123
GET /api/app-users/get?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "clx123abc",
    "wpUserId": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "displayName": "John",
    "phone": "+1234567890",
    "age": 30,
    "height": "5'10\"",
    "weight": "180",
    "goal": "170",
    "initialWeight": "185",
    "weightSet": true,
    "status": "Active",
    "lastLoginAt": "2024-01-15T10:30:00.000Z",
    "lastLoginIp": "192.168.1.1",
    "loginCount": 5,
    "tasksToday": 3,
    "totalWorkouts": 25,
    "totalCalories": 5000,
    "streak": 7,
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing both wpUserId and email parameters
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: User not found

**Important Notes:**
- The endpoint automatically tracks and resets daily task status
- Task status resets at midnight (new day)
- `tasksToday` field shows the count of completed tasks (0-3)
- `taskStatus` field contains: `{ date: "YYYY-MM-DD", tasks: [boolean, boolean, boolean] }` - tracks 3 tasks completion for the day

---

#### 3. Get Task Status

Retrieve the current task status for a user. Tasks reset daily and there are 3 tasks per day.

**Endpoint:** `GET /api/app-users/get`

**Note:** This is the same endpoint as "Get User" above. The task status is automatically included in the user response. The system automatically:
- Resets task status to all incomplete (false) for a new day
- Updates `tasksToday` count based on completed tasks
- Returns the current task status in the `taskStatus` field

**Response includes task status:**
```json
{
  "success": true,
  "user": {
    "id": "clx123abc",
    "wpUserId": "123",
    "email": "user@example.com",
    "tasksToday": 2,
    "taskStatus": {
      "date": "2024-01-15",
      "tasks": [true, true, false]
    },
    ...
  }
}
```

**Task Status Fields:**
- `date` (string): The date these tasks are for (YYYY-MM-DD format)
- `tasks` (array of booleans): Array of 3 boolean values indicating task completion
  - `tasks[0]`: First task completion status
  - `tasks[1]`: Second task completion status
  - `tasks[2]`: Third task completion status
- `tasksToday` (number): Count of completed tasks (0-3)

**Important Notes:**
- Tasks automatically reset at midnight (new day)
- If `taskStatus` is null or the date doesn't match today, it will be reset automatically
- The `tasksToday` field is automatically updated to match the number of completed tasks
- All 3 tasks are the same every day and reset daily

---

### Weight Logs

#### 3. Submit Weight Log

Submit a new weight log entry for a user.

**Endpoint:** `POST /api/weight-logs/public`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "userId": "123",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "weight": 175.5,
  "date": "2024-01-15T10:30:00.000Z"
}
```

**Required Fields:**
- `userId` (string): WordPress user ID or user identifier
- `userEmail` (string): User email address
- `weight` (number): Weight in lbs (must be positive)

**Optional Fields:**
- `userName` (string): User's name
- `date` (string, ISO 8601): Date of the weight log (defaults to current date/time)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Weight log created successfully",
  "weightLog": {
    "id": "clx456def",
    "userId": "123",
    "userEmail": "user@example.com",
    "userName": "John Doe",
    "date": "2024-01-15",
    "weight": 175.5,
    "previousWeight": 180.0,
    "change": -4.5,
    "changeType": "decrease",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Change Types:**
- `increase`: Weight increased from previous log
- `decrease`: Weight decreased from previous log
- `no-change`: Weight remained the same

**Important Notes:**
- The system automatically calculates the change from the previous weight log
- If no previous weight log exists, `previousWeight`, `change`, and `changeType` will be `null`
- The user's current weight in the `app_user` table is automatically updated
- If the user doesn't exist, a new user record is created automatically

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid weight value
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: Server error

---

#### 4. Get Weight Logs

Retrieve all weight logs for a specific user. The endpoint automatically finds all weight logs associated with the user's email or user ID, with improved matching and backward compatibility.

**Endpoint:** `GET /api/weight-logs/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `userId` (string, optional): WordPress user ID
- `userEmail` (string, optional): User email address
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)
- `startDate` (string, optional): Filter from date (YYYY-MM-DD)
- `endDate` (string, optional): Filter to date (YYYY-MM-DD)

**Note:** At least one of `userId` or `userEmail` must be provided.

**Example Request:**
```http
GET /api/weight-logs/public?userId=123&page=1&limit=50
GET /api/weight-logs/public?userEmail=user@example.com
GET /api/weight-logs/public?userEmail=user@example.com&startDate=2024-01-01&endDate=2024-01-31
GET /api/weight-logs/public?userEmail=user@example.com&page=1&limit=100
```

**Response (200 OK):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "clx456def",
      "userId": "123",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "appUser": {
        "id": "clx123abc",
        "email": "user@example.com",
        "name": "John Doe",
        "displayName": "John",
        "wpUserId": "123"
      },
      "date": "2024-01-15",
      "weight": 175.5,
      "previousWeight": 180.0,
      "change": -4.5,
      "changeType": "decrease",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "clx789ghi",
      "userId": "123",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "appUser": null,
      "date": "2024-01-10",
      "weight": 180.0,
      "previousWeight": null,
      "change": null,
      "changeType": null,
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-10T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Response Fields:**
- `success` (boolean): Indicates if the request was successful
- `logs` (array): Array of weight log objects
  - `id` (string): Unique identifier for the weight log
  - `userId` (string): User ID from the log
  - `userEmail` (string): User email from the log
  - `userName` (string): User name (from log or appUser)
  - `appUser` (object|null): App user information if available, null for backward compatibility
  - `date` (string): Date of the weight log (YYYY-MM-DD format)
  - `weight` (number): Weight in lbs
  - `previousWeight` (number|null): Previous weight for comparison
  - `change` (number|null): Change in weight from previous log
  - `changeType` (string|null): Type of change - "increase", "decrease", or "no-change"
  - `createdAt` (string): ISO 8601 timestamp of when the log was created
  - `updatedAt` (string): ISO 8601 timestamp of when the log was last updated
- `pagination` (object): Pagination information
  - `page` (number): Current page number
  - `limit` (number): Items per page
  - `total` (number): Total number of weight logs
  - `totalPages` (number): Total number of pages
  - `hasNextPage` (boolean): Whether there are more pages
  - `hasPreviousPage` (boolean): Whether there are previous pages

**Important Notes:**
- **Email Matching**: Email addresses are automatically normalized (lowercase, trimmed) for accurate matching
- **User Lookup**: The endpoint first tries to find the user by `wpUserId` or email in the `app_user` table
- **Backward Compatibility**: If no AppUser is found, the endpoint searches weight logs by `userEmail` or `userId` fields directly
- **All Logs**: Returns all weight logs associated with the user, regardless of how they were created
- **Default Limit**: Default limit is 50 (increased from 10) to retrieve more logs by default
- **Max Limit**: Maximum limit is 100 (increased from 50) for retrieving large datasets
- **Date Filtering**: Use `startDate` and `endDate` to filter logs within a specific date range
- **Ordering**: Logs are ordered by date in descending order (most recent first)
- **Empty Response**: If no user is found, returns an empty array with pagination info (not an error)

**Error Responses:**
- `400 Bad Request`: Missing both userId and userEmail parameters
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: Server error

---

### Blogs

#### 5. Get Blogs

Retrieve published blog posts.

**Endpoint:** `GET /api/blogs/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `id` (string, optional): Get a single blog by ID
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 50)
- `search` (string, optional): Search term (searches title, tagline, description, and tags)
- `tag` (string, optional): Filter by specific tag

**Example Request:**
```http
GET /api/blogs/public?page=1&limit=10
GET /api/blogs/public?id=clx789ghi
GET /api/blogs/public?search=health&tag=fitness
```

**Response - Single Blog (200 OK):**
```json
{
  "success": true,
  "blog": {
    "id": "clx789ghi",
    "title": "10 Tips for Healthy Living",
    "tagline": "Discover the secrets to a healthier lifestyle",
    "description": "<p>Rich HTML content here...</p>",
    "tags": ["health", "fitness", "wellness"],
    "featuredImage": "https://example.com/image.jpg",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-12T14:30:00.000Z"
  }
}
```

**Response - List of Blogs (200 OK):**
```json
{
  "success": true,
  "blogs": [
    {
      "id": "clx789ghi",
      "title": "10 Tips for Healthy Living",
      "tagline": "Discover the secrets to a healthier lifestyle",
      "description": "<p>Rich HTML content here...</p>",
      "tags": ["health", "fitness", "wellness"],
      "featuredImage": "https://example.com/image.jpg",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Important Notes:**
- Only published blogs are returned
- The `description` field contains HTML content that should be rendered in a WebView or HTML renderer
- Tags are returned as an array of strings

**Error Responses:**
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Blog not found or not published (when using `id` parameter)
- `500 Internal Server Error`: Server error

---

### Medicines

#### 6. Get Medicines

Retrieve active medicines/products.

**Endpoint:** `GET /api/medicines/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `id` (string, optional): Get a single medicine by ID
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 50)
- `search` (string, optional): Search term (searches title, tagline, and description)
- `categoryId` (number, optional): Filter by category ID

**Example Request:**
```http
GET /api/medicines/public?page=1&limit=10
GET /api/medicines/public?id=clx123abc
GET /api/medicines/public?categoryId=1&search=vitamin
```

**Response - Single Medicine (200 OK):**
```json
{
  "success": true,
  "medicine": {
    "id": "clx123abc",
    "categoryId": 1,
    "category": {
      "id": 1,
      "title": "Weight Loss",
      "tagline": "Accelerate Your Metabolism Naturally",
      "icon": "/medicine/category-icons/1766203299813_icon.png"
    },
    "title": "Premium Fat Burner",
    "tagline": "Advanced weight loss formula",
    "description": "Detailed product description...",
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "url": "https://example.com/product/premium-fat-burner",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-12T14:30:00.000Z"
  }
}
```

**Response - List of Medicines (200 OK):**
```json
{
  "success": true,
  "medicines": [
    {
      "id": "clx123abc",
      "categoryId": 1,
      "category": {
        "id": 1,
        "title": "Weight Loss",
        "tagline": "Accelerate Your Metabolism Naturally",
        "icon": "/medicine/category-icons/1766203299813_icon.png"
      },
      "title": "Premium Fat Burner",
      "tagline": "Advanced weight loss formula",
      "description": "Detailed product description...",
      "image": "data:image/png;base64,iVBORw0KGgo...",
      "url": "https://example.com/product/premium-fat-burner",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Important Notes:**
- Only active medicines are returned
- Images are stored as Base64 data URLs
- Each medicine includes its category information with icon
- Category icons are returned as relative paths (e.g., `/medicine/category-icons/filename.png`) and should be resolved to full URLs on the client side

**Error Responses:**
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Medicine not found or not active (when using `id` parameter)
- `500 Internal Server Error`: Server error

---

### Medicine Categories

#### 7. Get Medicine Categories

Retrieve medicine categories.

**Endpoint:** `GET /api/medicine-categories/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `id` (number, optional): Get a single category by ID
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50, max: 100)
- `search` (string, optional): Search term (searches title and tagline)

**Example Request:**
```http
GET /api/medicine-categories/public?page=1&limit=50
GET /api/medicine-categories/public?id=1
GET /api/medicine-categories/public?search=weight
```

**Response - Single Category (200 OK):**
```json
{
  "success": true,
  "category": {
    "id": 1,
    "title": "Weight Loss",
    "tagline": "Accelerate Your Metabolism Naturally",
    "icon": "/medicine/category-icons/1766203299813_icon.png",
    "medicineCount": 15,
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-12T14:30:00.000Z"
  }
}
```

**Response - List of Categories (200 OK):**
```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "title": "Weight Loss",
      "tagline": "Accelerate Your Metabolism Naturally",
      "icon": "/medicine/category-icons/1766203299813_icon.png",
      "medicineCount": 15,
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-12T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Important Notes:**
- Category IDs are numeric and start from 1
- Each category includes the count of medicines in that category
- Category icons are returned as relative paths (e.g., `/medicine/category-icons/filename.png`) and should be resolved to full URLs on the client side
- The `icon` field may be `null` if no icon has been uploaded for the category

**Error Responses:**
- `400 Bad Request`: Invalid category ID format
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Category not found (when using `id` parameter)
- `500 Internal Server Error`: Server error

---

### Push Notifications

#### 8. Get Notifications

Retrieve active push notifications.

**Endpoint:** `GET /api/notifications/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `id` (string, optional): Get a single notification by ID
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 50)

**Example Request:**
```http
GET /api/notifications/public?page=1&limit=20
GET /api/notifications/public?id=clx123abc
```

**Response - Single Notification (200 OK):**
```json
{
  "success": true,
  "notification": {
    "id": "clx123abc",
    "title": "New Product Available",
    "description": "Check out our latest weight loss supplement!",
    "image": "/notifications/images/1766203299813_image.png",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response - List of Notifications (200 OK):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "clx123abc",
      "title": "New Product Available",
      "description": "Check out our latest weight loss supplement!",
      "image": "/notifications/images/1766203299813_image.png",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Important Notes:**
- Only active notifications are returned
- Images are returned as relative paths and should be resolved to full URLs on the client side
- The `image` field may be `null` if no image has been uploaded for the notification

**Error Responses:**
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Notification not found or not active (when using `id` parameter)
- `500 Internal Server Error`: Server error

---

#### 9. Register FCM Token

Register or update Firebase Cloud Messaging (FCM) token for push notifications.

**Endpoint:** `POST /api/app-users/fcm-token`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "wpUserId": "123",
  "email": "user@example.com",
  "fcmToken": "device_fcm_token_here"
}
```

**Required Fields:**
- `wpUserId` (string): WordPress user ID
- `email` (string): User email address
- `fcmToken` (string): Firebase Cloud Messaging token from the device

**Response (200 OK):**
```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "user": {
    "id": "clx123abc",
    "wpUserId": "123",
    "email": "user@example.com",
    "fcmTokenRegistered": true
  }
}
```

**Important Notes:**
- This endpoint should be called when the app receives an FCM token from Firebase
- If the user doesn't exist, a new user record will be created
- If the user exists, the FCM token will be updated
- The FCM token should be refreshed and re-registered periodically (when token changes)

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: Server error

---

#### 10. Remove FCM Token

Remove FCM token when user logs out or unsubscribes from push notifications.

**Endpoint:** `DELETE /api/app-users/fcm-token`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `wpUserId` (string, optional): WordPress user ID
- `email` (string, optional): User email address

**Note:** At least one of `wpUserId` or `email` must be provided.

**Example Request:**
```http
DELETE /api/app-users/fcm-token?wpUserId=123
DELETE /api/app-users/fcm-token?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "FCM token removed successfully"
}
```

**Important Notes:**
- This endpoint should be called when the user logs out
- After removing the token, the user will no longer receive push notifications
- The user can re-register their token by calling the register endpoint again

**Error Responses:**
- `400 Bad Request`: Missing both wpUserId and email parameters
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

### Medication Logs

#### 11. Get Medication Logs

Retrieve medication logs for a user, organized by weeks (last 4 weeks).

**Endpoint:** `GET /api/app-users/medication-log`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `wpUserId` (string, optional): WordPress user ID
- `email` (string, optional): User email address

**Note:** At least one of `wpUserId` or `email` must be provided.

**Example Request:**
```http
GET /api/app-users/medication-log?wpUserId=123
GET /api/app-users/medication-log?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "weeks": [
    {
      "week": 1,
      "startDate": "2024-01-22",
      "endDate": "2024-01-28",
      "logs": [
        {
          "id": "clx789ghi",
          "medicineName": "Vitamin D",
          "dosage": "1000 IU",
          "takenAt": "2024-01-25T08:30:00.000Z"
        },
        {
          "id": "clx790hij",
          "medicineName": "Multivitamin",
          "dosage": "1 tablet",
          "takenAt": "2024-01-26T09:00:00.000Z"
        }
      ]
    },
    {
      "week": 2,
      "startDate": "2024-01-15",
      "endDate": "2024-01-21",
      "logs": [
        {
          "id": "clx791ijk",
          "medicineName": "Vitamin D",
          "dosage": "1000 IU",
          "takenAt": "2024-01-18T08:30:00.000Z"
        }
      ]
    },
    {
      "week": 3,
      "startDate": "2024-01-08",
      "endDate": "2024-01-14",
      "logs": []
    },
    {
      "week": 4,
      "startDate": "2024-01-01",
      "endDate": "2024-01-07",
      "logs": []
    }
  ],
  "totalLogs": 3
}
```

**Response Fields:**
- `weeks` (array): Array of 4 week objects (most recent week first)
  - `week` (number): Week number (1-4, where 1 is the most recent week)
  - `startDate` (string): Start date of the week (YYYY-MM-DD)
  - `endDate` (string): End date of the week (YYYY-MM-DD)
  - `logs` (array): Array of medication log entries for that week
    - `id` (string): Log entry ID
    - `medicineName` (string): Name of the medicine
    - `dosage` (string): Dosage information
    - `takenAt` (string): ISO 8601 timestamp when medicine was taken
- `totalLogs` (number): Total number of logs across all 4 weeks

**Important Notes:**
- Returns medication logs for the last 4 weeks only
- Weeks are organized from most recent (week 1) to oldest (week 4)
- Each week spans 7 days
- Empty weeks will have an empty `logs` array
- Logs are sorted by `takenAt` in descending order (most recent first)

**Error Responses:**
- `400 Bad Request`: Missing both wpUserId and email parameters
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

#### 12. Log Medication

Log when a user takes medication with dosage and time information.

**Endpoint:** `POST /api/app-users/medication-log`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "wpUserId": "123",
  "email": "user@example.com",
  "medicineId": "clx123abc",
  "medicineName": "Vitamin D",
  "dosage": "1000 IU",
  "takenAt": "2024-01-25T08:30:00.000Z"
}
```

**Required Fields:**
- `medicineName` (string): Name of the medicine
- `dosage` (string): Dosage information (e.g., "1000 IU", "1 tablet", "500mg")

**Optional Fields:**
- `wpUserId` (string): WordPress user ID (required if email not provided)
- `email` (string): User email address (required if wpUserId not provided)
- `medicineId` (string): Optional reference to Medicine ID from the medicines API
- `takenAt` (string, ISO 8601): Timestamp when medicine was taken (defaults to current time if not provided)

**Note:** At least one of `wpUserId` or `email` must be provided.

**Response (201 Created):**
```json
{
  "success": true,
  "log": {
    "id": "clx789ghi",
    "appUserId": "clx123abc",
    "medicineId": "clx123abc",
    "medicineName": "Vitamin D",
    "dosage": "1000 IU",
    "takenAt": "2024-01-25T08:30:00.000Z",
    "createdAt": "2024-01-25T08:30:00.000Z",
    "updatedAt": "2024-01-25T08:30:00.000Z"
  }
}
```

**Important Notes:**
- This endpoint should be called when the user clicks "Log Medicine" button in the app
- The medication log is tracked weekly for 4 weeks
- If `takenAt` is not provided, it defaults to the current server time
- The `medicineId` is optional and can reference a medicine from the medicines API
- Medication logs are displayed in the admin dashboard organized by weeks

**Error Responses:**
- `400 Bad Request`: Missing required fields (medicineName, dosage) or missing user identifier
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

### WooCommerce Integration

#### 13. Get WooCommerce Orders

Retrieve orders from WooCommerce based on user email.

**Endpoint:** `GET /api/woocommerce/orders`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `email` (string, required): User email address

**Example Request:**
```http
GET /api/woocommerce/orders?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "orders": [
    {
      "id": 12345,
      "status": "processing",
      "date_created": "2024-01-15T10:30:00",
      "total": "99.99",
      "currency": "USD",
      "line_items": [
        {
          "id": 678,
          "name": "Premium Fat Burner",
          "quantity": 2,
          "price": "49.99",
          "image": "https://example.com/product-image.jpg"
        }
      ],
      "billing": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "user@example.com",
        "phone": "+1234567890"
      },
      "shipping": {
        "first_name": "John",
        "last_name": "Doe",
        "address_1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postcode": "10001",
        "country": "US"
      }
    }
  ]
}
```

**Important Notes:**
- WooCommerce API credentials must be configured in admin settings
- The API automatically enriches order items with product details (name, quantity, image)
- Only orders for the specified email are returned

**Error Responses:**
- `400 Bad Request`: Missing email parameter or invalid WooCommerce API URL
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: WooCommerce API error or configuration issue

---

#### 14. Cancel WooCommerce Order

Cancel an order in WooCommerce.

**Endpoint:** `POST /api/woocommerce/orders`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "orderId": 12345,
  "email": "user@example.com"
}
```

**Required Fields:**
- `orderId` (number): WooCommerce order ID
- `email` (string): User email for verification

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "order": {
    "id": 12345,
    "status": "cancelled",
    ...
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: Order does not belong to the specified email
- `404 Not Found`: Order not found
- `409 Conflict`: Order cannot be cancelled (already cancelled or completed)
- `500 Internal Server Error`: Server error

---

#### 15. Get WooCommerce Subscriptions

Retrieve subscriptions from WooCommerce based on user email.

**Endpoint:** `GET /api/woocommerce/subscriptions`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `email` (string, required): User email address

**Example Request:**
```http
GET /api/woocommerce/subscriptions?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "email": "user@example.com",
  "customerId": 123,
  "count": 1,
  "subscriptions": [
    {
      "id": 789,
      "status": "active",
      "date_created": "2024-01-01T00:00:00",
      "next_payment_date": "2024-02-01T00:00:00",
      "billing_period": "month",
      "billing_interval": 1,
      "total": "29.99",
      "currency": "USD",
      "line_items": [
        {
          "id": 456,
          "name": "Monthly Premium Plan",
          "quantity": 1,
          "price": "29.99"
        }
      ]
    }
  ]
}
```

**Important Notes:**
- Requires WooCommerce Subscriptions plugin to be installed
- WooCommerce API credentials must be configured in admin settings
- Subscriptions are filtered by customer email if customer ID is not found

**Error Responses:**
- `400 Bad Request`: Missing email parameter or invalid WooCommerce API URL
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Subscriptions endpoint not found (plugin may not be installed)
- `500 Internal Server Error`: WooCommerce API error or configuration issue

---

#### 16. Cancel or Manage WooCommerce Subscription

Cancel, pause, resume, or update a subscription in WooCommerce.

**Endpoint:** `POST /api/woocommerce/subscriptions`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "subscriptionId": 789,
  "email": "user@example.com",
  "action": "cancel"
}
```

**Required Fields:**
- `subscriptionId` (number): WooCommerce subscription ID
- `email` (string): User email for verification
- `action` (string): Action to perform - `cancel`, `pause`, `resume`, or `update`

**Available Actions:**
- `cancel`: Cancels the subscription (sets status to "cancelled")
- `pause`: Pauses the subscription (sets status to "on-hold")
- `resume`: Resumes the subscription (sets status to "active")
- `update`: Updates subscription with custom data (requires `updateData` field)

**Update Action Example:**
```json
{
  "subscriptionId": 789,
  "email": "user@example.com",
  "action": "update",
  "updateData": {
    "billing_period": "year",
    "billing_interval": 1,
    "next_payment_date": "2025-01-01T00:00:00"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "subscription": {
    "id": 789,
    "status": "cancelled",
    "date_created": "2024-01-01T00:00:00",
    "date_modified": "2024-01-15T10:30:00",
    "next_payment_date": null,
    "end_date": "2024-01-15T10:30:00",
    ...
  }
}
```

**Important Notes:**
- Requires WooCommerce Subscriptions plugin to be installed
- Subscription must belong to the specified email
- All subscription statuses are included in the response

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid action
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: Subscription does not belong to the specified email
- `404 Not Found`: Subscription not found
- `500 Internal Server Error`: WooCommerce API error or configuration issue

---

#### 17. Get WooCommerce Billing Address

Retrieve billing address for a customer by email.

**Endpoint:** `GET /api/woocommerce/billing-address`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Query Parameters:**
- `email` (string, required): User email address

**Example Request:**
```http
GET /api/woocommerce/billing-address?email=user@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "email": "user@example.com",
  "customerId": 123,
  "billing": {
    "first_name": "John",
    "last_name": "Doe",
    "company": "ACME Corp",
    "address_1": "123 Main Street",
    "address_2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "postcode": "10001",
    "country": "US",
    "email": "user@example.com",
    "phone": "+1234567890"
  }
}
```

**Important Notes:**
- Customer must exist in WooCommerce
- Returns empty strings for fields that are not set
- Country code should be ISO 3166-1 alpha-2 format (e.g., "US", "GB", "CA")

**Error Responses:**
- `400 Bad Request`: Missing email parameter or invalid WooCommerce API URL
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Customer not found
- `500 Internal Server Error`: WooCommerce API error or configuration issue

---

#### 18. Update WooCommerce Billing Address

Update billing address for a customer by email.

**Endpoint:** `PUT /api/woocommerce/billing-address`

**Headers:**
```http
Content-Type: application/json
X-API-Key: ahc_live_sk_your_api_key_here
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "billing": {
    "first_name": "John",
    "last_name": "Doe",
    "company": "ACME Corp",
    "address_1": "123 Main Street",
    "address_2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "postcode": "10001",
    "country": "US",
    "email": "user@example.com",
    "phone": "+1234567890"
  }
}
```

**Required Fields:**
- `email` (string): User email address
- `billing` (object): Billing address object

**Billing Address Fields:**
- `first_name` (string, required): First name
- `last_name` (string, required): Last name
- `company` (string, optional): Company name
- `address_1` (string, required): Street address line 1
- `address_2` (string, optional): Street address line 2
- `city` (string, required): City
- `state` (string, required): State/Province code
- `postcode` (string, required): Postal/ZIP code
- `country` (string, required): Country code (ISO 3166-1 alpha-2, e.g., "US", "GB", "CA")
- `email` (string, required): Email address
- `phone` (string, optional): Phone number

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Billing address updated successfully",
  "email": "user@example.com",
  "customerId": 123,
  "billing": {
    "first_name": "John",
    "last_name": "Doe",
    "company": "ACME Corp",
    "address_1": "123 Main Street",
    "address_2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "postcode": "10001",
    "country": "US",
    "email": "user@example.com",
    "phone": "+1234567890"
  }
}
```

**Important Notes:**
- Customer must exist in WooCommerce before updating billing address
- Only provided fields will be updated; existing fields are preserved
- Country code must be in ISO 3166-1 alpha-2 format
- State code format varies by country (e.g., "NY" for US, "ON" for Canada)

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid WooCommerce API URL
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Customer not found (must register first)
- `500 Internal Server Error`: WooCommerce API error or configuration issue

---

## Firebase Cloud Messaging (FCM) Setup

To enable push notifications in your Android app, you need to set up Firebase Cloud Messaging (FCM). Follow these steps:

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enter your project name and follow the setup wizard
4. Enable Google Analytics (optional but recommended)
5. Click "Create project"

### Step 2: Add Android App to Firebase

1. In your Firebase project, click "Add app" and select Android
2. Enter your Android package name (e.g., `com.yourcompany.yourapp`)
3. Enter app nickname (optional)
4. Enter SHA-1 certificate fingerprint (optional for now, required for production)
5. Click "Register app"

### Step 3: Download Configuration File

1. Download `google-services.json` file
2. Place it in your Android app's `app/` directory (not in `src/`)
3. The file should be at: `app/google-services.json`

### Step 4: Add Firebase SDK to Android App

**In your `build.gradle` (Project level):**
```gradle
buildscript {
    dependencies {
        // Add this line
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**In your `build.gradle` (App level):**
```gradle
plugins {
    id 'com.android.application'
    // Add this line
    id 'com.google.gms.google-services'
}

dependencies {
    // Add Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging:23.3.1'
    // Add Firebase BOM for version management
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
}
```

### Step 5: Get FCM Token in Android App

Create a service to get the FCM token:

```kotlin
// FirebaseMessagingService.kt
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onNewToken(token: String) {
        // Send token to your server
        sendTokenToServer(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Handle received push notification
        remoteMessage.notification?.let {
            // Show notification
            showNotification(it.title, it.body, it.imageUrl)
        }
    }
    
    private fun sendTokenToServer(token: String) {
        // Call your API to register the token
        // POST /api/app-users/fcm-token
    }
}
```

**Get FCM Token:**
```kotlin
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (!task.isSuccessful) {
        Log.w(TAG, "Fetching FCM registration token failed", task.exception)
        return@addOnCompleteListener
    }
    
    // Get new FCM registration token
    val token = task.result
    Log.d(TAG, "FCM Registration Token: $token")
    
    // Send token to server
    sendTokenToServer(token)
}
```

### Step 6: Register Token with API

When you receive the FCM token, register it with the API:

```kotlin
fun registerFCMToken(wpUserId: String, email: String, fcmToken: String) {
    val requestBody = JSONObject().apply {
        put("wpUserId", wpUserId)
        put("email", email)
        put("fcmToken", fcmToken)
    }
    
    val request = Request.Builder()
        .url("$baseUrl/api/app-users/fcm-token")
        .post(requestBody.toString().toRequestBody("application/json".toMediaType()))
        .addHeader("X-API-Key", apiKey)
        .build()
    
    client.newCall(request).enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            if (response.isSuccessful) {
                Log.d(TAG, "FCM token registered successfully")
            }
        }
        
        override fun onFailure(call: Call, e: IOException) {
            Log.e(TAG, "Failed to register FCM token", e)
        }
    })
}
```

### Step 7: Configure FCM in Admin Dashboard

1. Go to your admin dashboard → Settings → WooCommerce tab
2. Scroll to "Firebase Cloud Messaging (FCM) Settings"
3. Enter your Firebase Project ID (from Firebase Console → Project Settings → General)
4. Enter your FCM Server Key (from Firebase Console → Project Settings → Cloud Messaging → Server key)
5. Click "Save Settings"

### Step 8: Get FCM Server Key

1. Go to Firebase Console → Your Project
2. Click the gear icon → Project Settings
3. Go to "Cloud Messaging" tab
4. Under "Cloud Messaging API (Legacy)", copy the "Server key"
5. Paste it in the admin dashboard settings

### Step 9: Test Push Notifications

1. Create a notification in the admin dashboard (Dashboard → Notifications)
2. Make sure the notification is set to "Active"
3. The push notification will be automatically sent to all users with registered FCM tokens
4. Users should receive the notification on their Android devices

### Important Notes

- **Token Refresh**: FCM tokens can change. Always listen for `onNewToken()` and re-register the token
- **Token Removal**: Call the DELETE endpoint when user logs out to stop receiving notifications
- **Error Handling**: Handle invalid token errors and remove them from your local storage
- **Background Notifications**: Configure notification channels for Android 8.0+
- **Production**: For production apps, you'll need to add your app's SHA-1 certificate fingerprint in Firebase Console

### Android Notification Channel Setup

For Android 8.0+ (API 26+), create a notification channel:

```kotlin
private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channelId = "default"
        val channelName = "Default Notifications"
        val channelDescription = "Default notification channel"
        val importance = NotificationManager.IMPORTANCE_HIGH
        
        val channel = NotificationChannel(channelId, channelName, importance).apply {
            description = channelDescription
            enableLights(true)
            lightColor = Color.BLUE
            enableVibration(true)
        }
        
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(channel)
    }
}
```

### Troubleshooting

- **No notifications received**: Check that FCM token is registered and notification is active
- **Token registration fails**: Verify API key is correct and user exists
- **Notifications not showing**: Check notification channel setup and app permissions
- **Token invalid errors**: Token may have expired, re-register the token

---

### FAQs

#### 17. Get FAQs

Retrieve all active frequently asked questions (FAQs) for display in the mobile app.

**Endpoint:** `GET /api/faqs/public`

**Headers:**
```http
X-API-Key: ahc_live_sk_your_api_key_here
```

**Example Request:**
```http
GET /api/faqs/public
```

**Response (200 OK):**
```json
{
  "success": true,
  "faqs": [
    {
      "id": "clx123abc456",
      "question": "How do I track my weight?",
      "answer": "You can log your weight by going to the Weight Log section and tapping the 'Add Weight' button. Enter your current weight and the app will automatically calculate the change from your previous entry.",
      "order": 1,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "clx789def012",
      "question": "How do I log my medication?",
      "answer": "To log medication, navigate to the Medication Log section and tap 'Log Medicine'. Select the medicine name, enter the dosage, and confirm. The app will track your medication intake for the last 4 weeks.",
      "order": 2,
      "createdAt": "2024-01-16T14:20:00.000Z"
    },
    {
      "id": "clx345ghi678",
      "question": "What are daily tasks?",
      "answer": "Daily tasks are three activities you need to complete each day. The task list resets every day at midnight. You can track your progress in the dashboard, and completed tasks are automatically counted.",
      "order": 3,
      "createdAt": "2024-01-17T09:15:00.000Z"
    }
  ],
  "total": 3
}
```

**Response Fields:**
- `success` (boolean): Indicates if the request was successful
- `faqs` (array): Array of FAQ objects
  - `id` (string): Unique identifier for the FAQ
  - `question` (string): The FAQ question
  - `answer` (string): The detailed answer to the question
  - `order` (number): Display order for sorting FAQs
  - `createdAt` (string): ISO 8601 timestamp of when the FAQ was created
- `total` (number): Total number of active FAQs returned

**Important Notes:**
- Only active FAQs are returned (inactive FAQs are filtered out)
- FAQs are sorted by `order` (ascending), then by `createdAt` (descending)
- The endpoint requires a valid API key
- FAQs can be managed through the admin dashboard at `/dashboard/faqs`

**Error Responses:**
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: Server error

**Example Usage (JavaScript/TypeScript):**
```typescript
async function fetchFAQs() {
  try {
    const response = await fetch('https://your-domain.com/api/faqs/public', {
      method: 'GET',
      headers: {
        'X-API-Key': 'ahc_live_sk_your_api_key_here',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log(`Fetched ${data.total} FAQs`);
      data.faqs.forEach((faq) => {
        console.log(`Q: ${faq.question}`);
        console.log(`A: ${faq.answer}`);
      });
      return data.faqs;
    }
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    throw error;
  }
}
```

**Example Usage (Kotlin/Android):**
```kotlin
suspend fun fetchFAQs(): List<FAQ> {
    val client = OkHttpClient()
    val request = Request.Builder()
        .url("https://your-domain.com/api/faqs/public")
        .addHeader("X-API-Key", "ahc_live_sk_your_api_key_here")
        .get()
        .build()

    val response = client.newCall(request).execute()
    
    if (!response.isSuccessful) {
        throw IOException("Unexpected code ${response.code}")
    }

    val responseBody = response.body?.string()
    val json = JSONObject(responseBody ?: "")
    
    if (json.getBoolean("success")) {
        val faqsArray = json.getJSONArray("faqs")
        val faqs = mutableListOf<FAQ>()
        
        for (i in 0 until faqsArray.length()) {
            val faqJson = faqsArray.getJSONObject(i)
            faqs.add(
                FAQ(
                    id = faqJson.getString("id"),
                    question = faqJson.getString("question"),
                    answer = faqJson.getString("answer"),
                    order = faqJson.getInt("order"),
                    createdAt = faqJson.getString("createdAt")
                )
            )
        }
        
        return faqs
    } else {
        throw Exception("Failed to fetch FAQs")
    }
}
```

---

## Error Handling

All API endpoints follow a consistent error response format:

### Error Response Structure

```json
{
  "error": "Error message describing what went wrong",
  "details": "Additional error details (only in development mode)"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters or missing required fields
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: Access denied (e.g., order doesn't belong to user)
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate registration)
- `500 Internal Server Error`: Server error

### Error Handling Best Practices

1. **Always check the HTTP status code** before processing the response
2. **Handle 401 errors** by prompting the user to re-authenticate
3. **Log error details** for debugging (but don't display sensitive information to users)
4. **Implement retry logic** for network errors (with exponential backoff)
5. **Show user-friendly error messages** based on the error type

### Example Error Handling (Flutter/Dart)

```dart
try {
  final response = await http.get(
    Uri.parse('$baseUrl/api/blogs/public'),
    headers: {
      'X-API-Key': apiKey,
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    // Process successful response
  } else if (response.statusCode == 401) {
    // Handle unauthorized - invalid API key
    throw Exception('Invalid API key. Please contact support.');
  } else {
    final error = json.decode(response.body);
    throw Exception(error['error'] ?? 'An error occurred');
  }
} catch (e) {
  // Handle network errors, timeouts, etc.
  print('Error: $e');
}
```

---

## Best Practices

### 1. API Key Security

- **Never commit API keys to version control**
- Store API keys securely (use secure storage on mobile devices)
- Rotate API keys periodically
- Use different API keys for development and production

### 2. Request Optimization

- **Use pagination** for large datasets (don't request all records at once)
- **Cache responses** when appropriate (blogs, categories, etc.)
- **Implement request debouncing** for search functionality
- **Use appropriate page sizes** (default limits are optimized)

### 3. Data Handling

- **Validate data** before sending to the API
- **Handle null values** appropriately
- **Parse dates correctly** (ISO 8601 format)
- **Display loading states** during API calls

### 4. Network Handling

- **Implement timeout handling** (recommended: 30 seconds)
- **Handle offline scenarios** gracefully
- **Retry failed requests** with exponential backoff
- **Show appropriate error messages** to users

### 5. User Experience

- **Show loading indicators** during API calls
- **Provide feedback** for user actions (success/error messages)
- **Implement pull-to-refresh** for lists
- **Cache frequently accessed data** locally

---

## Rate Limiting

Currently, there are no strict rate limits implemented. However, to ensure optimal performance:

- **Avoid making excessive requests** in a short time period
- **Implement client-side caching** to reduce API calls
- **Batch requests** when possible
- **Use pagination** instead of fetching all data at once

If you experience performance issues, contact the administrator to review API usage patterns.

---

## Example Integration (Flutter/Dart)

### API Service Class

```dart
class ApiService {
  static const String baseUrl = 'https://your-domain.com/api';
  static const String apiKey = 'ahc_live_sk_your_api_key_here';

  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  // Register User
  static Future<Map<String, dynamic>> registerUser({
    required String wpUserId,
    required String email,
    String? name,
    String? weight,
    String? goal,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/app-users/register'),
      headers: headers,
      body: json.encode({
        'wpUserId': wpUserId,
        'email': email,
        'name': name,
        'weight': weight,
        'goal': goal,
      }),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to register user');
    }
  }

  // Submit Weight Log
  static Future<Map<String, dynamic>> submitWeightLog({
    required String userId,
    required String userEmail,
    required double weight,
    String? date,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/weight-logs/public'),
      headers: headers,
      body: json.encode({
        'userId': userId,
        'userEmail': userEmail,
        'weight': weight,
        'date': date,
      }),
    );

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to submit weight log');
    }
  }

  // Get Weight Logs
  static Future<Map<String, dynamic>> getWeightLogs({
    String? userId,
    String? userEmail,
    int page = 1,
    int limit = 50,
    String? startDate,
    String? endDate,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (userId != null) {
      queryParams['userId'] = userId;
    }
    if (userEmail != null) {
      queryParams['userEmail'] = userEmail;
    }
    if (startDate != null) {
      queryParams['startDate'] = startDate;
    }
    if (endDate != null) {
      queryParams['endDate'] = endDate;
    }

    final uri = Uri.parse('$baseUrl/weight-logs/public').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: headers);

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to fetch weight logs');
    }
  }

  // Get Blogs
  static Future<Map<String, dynamic>> getBlogs({
    int page = 1,
    int limit = 10,
    String? search,
    String? tag,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (search != null) 'search': search,
      if (tag != null) 'tag': tag,
    };

    final response = await http.get(
      Uri.parse('$baseUrl/blogs/public').replace(queryParameters: queryParams),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to fetch blogs');
    }
  }

  // Get Medicines
  static Future<Map<String, dynamic>> getMedicines({
    int page = 1,
    int limit = 10,
    int? categoryId,
    String? search,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (categoryId != null) 'categoryId': categoryId.toString(),
      if (search != null) 'search': search,
    };

    final response = await http.get(
      Uri.parse('$baseUrl/medicines/public').replace(queryParameters: queryParams),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to fetch medicines');
    }
  }
}
```

---

## Support

For API support, issues, or questions:

1. Check this documentation first
2. Review error messages and status codes
3. Contact the development team with:
   - API endpoint being used
   - Request details (without sensitive data)
   - Error response received
   - Steps to reproduce

---

## Changelog

### Version 1.6.0 (Current)
- Improved Weight Logs GET endpoint
- Increased default limit from 10 to 50, max limit from 50 to 100
- Enhanced email matching with case-insensitive normalization
- Added backward compatibility to retrieve logs by userEmail/userId fields
- Better handling of logs when AppUser is not found
- All weight logs for a user are now properly retrieved regardless of how they were created

### Version 1.5.0
- Added FAQ endpoints (GET)
- Mobile apps can now retrieve all active FAQs
- FAQs are sorted by display order and creation date
- Only active FAQs are returned to mobile apps

### Version 1.4.0
- Added medication log endpoints (GET and POST)
- Users can now log medication intake with dosage and time
- Medication logs are organized by weeks (last 4 weeks)
- Added task status tracking in user endpoint
- Daily task tracking with automatic reset (3 tasks per day)
- Task status automatically resets at midnight

### Version 1.3.0
- Added WooCommerce billing address endpoints (GET and PUT)
- Users can now retrieve and update their billing address via API
- Improved WooCommerce subscriptions API to filter by email when customer ID is not found

### Version 1.2.0
- Added push notifications API endpoints
- Added FCM token registration and management endpoints
- Notifications can be retrieved with pagination support
- FCM integration for sending push notifications to Android devices

### Version 1.1.0
- Added `icon` field to medicine categories API responses
- Category icons are now included in both category and medicine endpoints
- Icons are returned as relative paths and should be resolved to full URLs on the client side

### Version 1.0.0
- Initial API documentation
- User registration and retrieval
- Weight logs submission and retrieval
- Blogs API
- Medicines and categories API
- WooCommerce integration (orders and subscriptions)

---

**Last Updated:** December 2024

**API Version:** 1.4.0

