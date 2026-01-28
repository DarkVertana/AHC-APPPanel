# App User API Documentation

This document describes the API endpoints for app user features used by the mobile app.

## Base URL

All endpoints are relative to your API base URL (e.g., `https://your-domain.com`).

## Authentication

The API supports two authentication methods:

### 1. API Key (Mobile App)

Include your API key in the request headers:

```
X-API-Key: ahc_live_sk_your_api_key_here
```

or

```
Authorization: Bearer ahc_live_sk_your_api_key_here
```

### 2. Session Auth (Admin Dashboard)

Admin users authenticated via the dashboard session can also access the GET endpoint with additional parameters (`userId`, `view`, `offset`).

---

## Daily Check-In Endpoints

### 1. Record Daily Check-In

Records a daily check-in for a user. Each user can only check in once per day per button type.

**Endpoint:** `POST /api/app-users/daily-checkin`

#### Query Parameters (URL)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | Check-in date in `YYYY-MM-DD` format (default: today) |
| `time` | string | No | Check-in time in `HH:MM` or `HH:MM:SS` format (default: current time) |

#### Request Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wpUserId` | string | Yes* | WordPress user ID |
| `email` | string | Yes* | User email address |
| `buttonType` | string | No | Type of check-in button (default: `"default"`) |
| `medicationName` | string | No | Name of medication (default: `"default"`). Multiple medications can be logged per day. |
| `deviceInfo` | string | No | Device information for analytics |

> *Either `wpUserId` or `email` must be provided to identify the user.

#### Example Request

**URL with date/time parameters:**
```
POST /api/app-users/daily-checkin?date=2024-01-15&time=08:30:00
```

**Request Body:**
```json
{
  "wpUserId": "12345",
  "email": "user@example.com",
  "buttonType": "default",
  "medicationName": "Semaglutide",
  "deviceInfo": "iPhone 14 Pro, iOS 17.2"
}
```

#### Success Response (201 Created)

```json
{
  "success": true,
  "alreadyCheckedIn": false,
  "message": "Check-in recorded successfully",
  "checkIn": {
    "id": "clx1abc123def456",
    "date": "2024-01-15",
    "buttonType": "default",
    "medicationName": "Semaglutide",
    "createdAt": "2024-01-15T08:30:00.000Z"
  },
  "user": {
    "email": "user@example.com",
    "wpUserId": "12345"
  }
}
```

#### Already Checked In Response (200 OK)

If the user has already checked in this medication for the specified date:

```json
{
  "success": false,
  "alreadyCheckedIn": true,
  "message": "You have already checked in today",
  "checkIn": {
    "id": "clx1abc123def456",
    "date": "2024-01-15",
    "buttonType": "default",
    "medicationName": "Semaglutide",
    "createdAt": "2024-01-15T08:30:00.000Z"
  },
  "user": {
    "email": "user@example.com",
    "wpUserId": "12345"
  }
}
```

> Note: Users can check in multiple different medications per day. The duplicate check is per medication name per date.

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Missing required fields (wpUserId or email) |
| 400 | Invalid date format (must be YYYY-MM-DD) |
| 400 | Invalid time format (must be HH:MM or HH:MM:SS) |
| 401 | Invalid or missing API key |
| 404 | User not found |
| 500 | Server error |

---

### 2. Get Check-In Status

Check if a user has checked in on a specific date (defaults to today) and optionally retrieve their check-in history with streak information.

**Endpoint:** `GET /api/app-users/daily-checkin`

**Authentication:** API key (mobile app) OR admin session (dashboard)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wpUserId` | string | Yes* | WordPress user ID |
| `email` | string | Yes* | User email address |
| `userId` | string | No | Internal user ID (admin only) |
| `date` | string | No | Date to check in `YYYY-MM-DD` format (default: today) |
| `buttonType` | string | No | Button type to check (default: `"default"`) |
| `history` | boolean | No | Set to `true` to include check-in history |
| `days` | number | No | Number of days of history to return (default: `7`) |
| `view` | string | No | Calendar view mode: `days`, `weeks`, or `month` (admin only) |
| `offset` | number | No | Pagination offset for calendar view (admin only) |

> *Either `wpUserId`, `email`, or `userId` (admin only) must be provided.

#### Example Requests

**Check today's status:**
```
GET /api/app-users/daily-checkin?wpUserId=12345
```

**Check a specific date:**
```
GET /api/app-users/daily-checkin?wpUserId=12345&date=2024-01-10
```

**Get history from a specific date:**
```
GET /api/app-users/daily-checkin?wpUserId=12345&date=2024-01-15&history=true&days=30
```

**Admin: Get calendar view for a user:**
```
GET /api/app-users/daily-checkin?userId=clx1abc123&view=weeks&offset=0
```

#### Response (Without History)

Returns all medications checked in for the specified date.

```json
{
  "success": true,
  "date": "2024-01-15",
  "today": "2024-01-15",
  "isToday": true,
  "checkedIn": true,
  "checkInCount": 2,
  "checkIns": [
    {
      "id": "clx1abc123def456",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Semaglutide",
      "createdAt": "2024-01-15T08:30:00.000Z"
    },
    {
      "id": "clx1abc789ghi012",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Tirzepatide",
      "createdAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "user": {
    "id": "clx1user123",
    "email": "user@example.com",
    "wpUserId": "12345",
    "name": "John Doe"
  }
}
```

#### Response (With History)

```json
{
  "success": true,
  "date": "2024-01-15",
  "today": "2024-01-15",
  "isToday": true,
  "checkedIn": true,
  "checkInCount": 2,
  "checkIns": [
    {
      "id": "clx1abc123def456",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Semaglutide",
      "createdAt": "2024-01-15T08:30:00.000Z"
    },
    {
      "id": "clx1abc789ghi012",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Tirzepatide",
      "createdAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "user": {
    "id": "clx1user123",
    "email": "user@example.com",
    "wpUserId": "12345",
    "name": "John Doe"
  },
  "history": [
    {
      "id": "clx1abc123def456",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Semaglutide",
      "createdAt": "2024-01-15T08:30:00.000Z"
    },
    {
      "id": "clx1abc789ghi012",
      "date": "2024-01-15",
      "buttonType": "default",
      "medicationName": "Tirzepatide",
      "createdAt": "2024-01-15T09:00:00.000Z"
    },
    {
      "id": "clx1abc345jkl678",
      "date": "2024-01-14",
      "buttonType": "default",
      "medicationName": "Semaglutide",
      "createdAt": "2024-01-14T09:15:00.000Z"
    }
  ],
  "streak": 2
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Missing required fields (wpUserId or email) |
| 400 | Invalid date format (must be YYYY-MM-DD) |
| 401 | Invalid or missing API key |
| 404 | User not found |
| 500 | Server error |

---

## Account Management Endpoints

### 3. Delete User Account

Permanently deletes a user account and all associated data. This is a destructive operation that cannot be undone.

**Endpoint:** `DELETE /api/app-users/delete`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wpUserId` | string | Yes* | WordPress user ID |
| `email` | string | Yes* | User email address |

> *Either `wpUserId` or `email` must be provided to identify the user.

#### Example Request

```
DELETE /api/app-users/delete?wpUserId=12345
```

or

```
DELETE /api/app-users/delete?email=user@example.com
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "User and all associated data deleted successfully",
  "deleted": {
    "userId": "clx1abc123def456",
    "wpUserId": "12345",
    "email": "user@example.com",
    "weightLogs": 45,
    "medicationLogs": 30
  }
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Missing required fields (wpUserId or email) |
| 401 | Invalid or missing API key |
| 404 | User not found |
| 500 | Server error |

#### Data Deleted

When a user account is deleted, the following data is permanently removed:

| Data Type | Description |
|-----------|-------------|
| User Profile | Basic user information (email, wpUserId, name, etc.) |
| Weight Logs | All weight tracking entries |
| Medication Logs | All medication tracking entries |
| Daily Check-Ins | All daily check-in records |
| FCM Tokens | Push notification tokens |

#### Implementation Examples

**iOS (Swift):**
```swift
func deleteAccount(wpUserId: String) async throws -> DeleteResponse {
    var urlComponents = URLComponents(string: "\(baseURL)/api/app-users/delete")!
    urlComponents.queryItems = [URLQueryItem(name: "wpUserId", value: wpUserId)]

    var request = URLRequest(url: urlComponents.url!)
    request.httpMethod = "DELETE"
    request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(DeleteResponse.self, from: data)
}
```

**Android (Kotlin):**
```kotlin
suspend fun deleteAccount(wpUserId: String): DeleteResponse {
    val client = OkHttpClient()

    val url = "$baseUrl/api/app-users/delete".toHttpUrl().newBuilder()
        .addQueryParameter("wpUserId", wpUserId)
        .build()

    val request = Request.Builder()
        .url(url)
        .delete()
        .addHeader("X-API-Key", apiKey)
        .build()

    return withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            gson.fromJson(response.body?.string(), DeleteResponse::class.java)
        }
    }
}
```

**React Native / JavaScript:**
```javascript
async function deleteAccount(wpUserId) {
  const params = new URLSearchParams({ wpUserId });

  const response = await fetch(
    `${BASE_URL}/api/app-users/delete?${params}`,
    {
      method: 'DELETE',
      headers: {
        'X-API-Key': API_KEY,
      },
    }
  );

  return response.json();
}
```

#### Best Practices

1. **Confirm before deletion**: Always show a confirmation dialog to the user before calling this endpoint.

2. **Require re-authentication**: Consider requiring the user to re-enter their password or use biometric authentication before account deletion.

3. **Clear local data**: After successful deletion, clear all locally cached user data from the app.

4. **Log out the user**: Redirect the user to the login/welcome screen after account deletion.

---

## Streak Calculation

The streak represents the number of consecutive days a user has checked in, counting backwards from today.

- If the user checked in today, yesterday, and the day before, the streak is `3`
- If the user missed a day, the streak resets from the most recent consecutive period
- The streak is calculated for up to 60 days of history

---

## Button Types

The `buttonType` parameter allows you to track different types of check-ins separately. Each button type maintains its own check-in status and streak.

Common use cases:
- `"default"` - Standard daily check-in
- `"morning"` - Morning routine check-in
- `"workout"` - Workout completion check-in

Users can check in once per day per button type.

---

## Implementation Examples

### iOS (Swift)

```swift
func performDailyCheckIn(
    wpUserId: String,
    date: String? = nil,  // Optional: YYYY-MM-DD format
    time: String? = nil   // Optional: HH:MM:SS format
) async throws -> CheckInResponse {
    // Build URL with query parameters
    var urlComponents = URLComponents(string: "\(baseURL)/api/app-users/daily-checkin")!
    var queryItems: [URLQueryItem] = []

    if let date = date {
        queryItems.append(URLQueryItem(name: "date", value: date))
    }
    if let time = time {
        queryItems.append(URLQueryItem(name: "time", value: time))
    }

    if !queryItems.isEmpty {
        urlComponents.queryItems = queryItems
    }

    var request = URLRequest(url: urlComponents.url!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

    let body: [String: Any] = [
        "wpUserId": wpUserId,
        "buttonType": "default",
        "deviceInfo": UIDevice.current.model
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(CheckInResponse.self, from: data)
}

// Usage examples:
// Check in for today (current time):
// try await performDailyCheckIn(wpUserId: "12345")

// Check in for a specific date and time:
// try await performDailyCheckIn(wpUserId: "12345", date: "2024-01-15", time: "08:30:00")
```

### Android (Kotlin)

```kotlin
suspend fun performDailyCheckIn(
    wpUserId: String,
    date: String? = null,  // Optional: YYYY-MM-DD format
    time: String? = null   // Optional: HH:MM:SS format
): CheckInResponse {
    val client = OkHttpClient()

    // Build URL with query parameters
    val urlBuilder = "$baseUrl/api/app-users/daily-checkin".toHttpUrl().newBuilder()
    date?.let { urlBuilder.addQueryParameter("date", it) }
    time?.let { urlBuilder.addQueryParameter("time", it) }

    val body = JSONObject().apply {
        put("wpUserId", wpUserId)
        put("buttonType", "default")
        put("deviceInfo", Build.MODEL)
    }

    val request = Request.Builder()
        .url(urlBuilder.build())
        .post(body.toString().toRequestBody("application/json".toMediaType()))
        .addHeader("X-API-Key", apiKey)
        .build()

    return withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
            gson.fromJson(response.body?.string(), CheckInResponse::class.java)
        }
    }
}

// Usage examples:
// Check in for today: performDailyCheckIn("12345")
// Check in for specific date/time: performDailyCheckIn("12345", "2024-01-15", "08:30:00")
```

### React Native / JavaScript

```javascript
async function performDailyCheckIn(wpUserId, options = {}) {
  const { date, time } = options;

  // Build URL with query parameters
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (time) params.append('time', time);

  const queryString = params.toString();
  const url = `${BASE_URL}/api/app-users/daily-checkin${queryString ? '?' + queryString : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      wpUserId,
      buttonType: 'default',
      deviceInfo: Platform.OS + ' ' + Platform.Version,
    }),
  });

  return response.json();
}

// Usage examples:
// Check in for today: await performDailyCheckIn('12345')
// Check in for specific date/time: await performDailyCheckIn('12345', { date: '2024-01-15', time: '08:30:00' })

async function getCheckInStatus(wpUserId, options = {}) {
  const { date, includeHistory = false, days = 30 } = options;

  const params = new URLSearchParams({
    wpUserId,
    history: includeHistory.toString(),
    days: days.toString(),
  });

  if (date) params.append('date', date);

  const response = await fetch(
    `${BASE_URL}/api/app-users/daily-checkin?${params}`,
    {
      headers: {
        'X-API-Key': API_KEY,
      },
    }
  );

  return response.json();
}

// Usage examples:
// Get today's status: await getCheckInStatus('12345')
// Get status for specific date: await getCheckInStatus('12345', { date: '2024-01-10' })
// Get history from specific date: await getCheckInStatus('12345', { date: '2024-01-15', includeHistory: true })
```

---

## Best Practices

1. **Check status first**: Before showing the check-in button, call the GET endpoint to see if the user has already checked in today.

2. **Handle duplicate check-ins gracefully**: If `alreadyCheckedIn` is `true`, show a friendly message instead of an error.

3. **Cache the streak**: Store the streak locally and update it optimistically when the user checks in.

4. **Include device info**: Sending device information helps with debugging and analytics.

5. **Handle offline scenarios**: Queue check-in requests when offline and sync when connectivity is restored.

---

## Data Model Reference

The check-in data is stored with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (CUID format) |
| `appUserId` | string | Reference to the app user |
| `date` | string | Check-in date (YYYY-MM-DD format, UTC) |
| `buttonType` | string | Type of check-in button |
| `medicationName` | string | Optional medication name associated with check-in |
| `deviceInfo` | string | Optional device information |
| `ipAddress` | string | Captured IP address (internal use) |
| `createdAt` | datetime | Timestamp of check-in |

---

## Rate Limits

- Standard API rate limits apply
- The unique constraint prevents duplicate check-ins per user/day/buttonType combination
