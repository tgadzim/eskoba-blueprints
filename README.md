# eskoba-blueprint-lms

## Firestore module catalog

The LMS loads module definitions from the `modules` collection and uses the
built-in catalog when Firestore is empty or unavailable.

Each `modules/{moduleId}` document supports:

```text
title: string
description: string
path: string
status: draft | coming-soon | published | improvement | archived
requiredPlan: free | starter | premium | enterprise
sortOrder: number
isPaid: boolean
thumbnailPath: string
thumbnailUrl: string

Legacy compatibility:
order: number
published: boolean
```

Lessons may alternatively be stored as documents in
`modules/{moduleId}/lessons/{lessonId}`:

```text
title: string
description: string
status: draft | published | hidden | improvement | archived
sortOrder: number
lessonContentType: html | video | slide-deck | mixed
youtubeUrl: string
lessonContentHtml: string
quizId: string
videoPath/videoUrl: string
htmlFilePath/htmlFileUrl: string
resourcePath/resourceUrl: string

Legacy compatibility:
path/url: string
order: number
published: boolean
```

Paths are relative to the site root, for example:
`modules/meta-advertising-andromeda2026/lesson-1.html`.

Progress is read from the module-scoped path first:

```text
progress/{userId}/modules/{moduleId}/lessons/{lessonId}
```

During migration, lesson completion also reads and writes the existing path:

```text
progress/{userId}/lessons/{lessonId}
```

## User subscription access

Module locking reads these fields from `users/{uid}`:

```text
subscriptionStatus: string
subscriptionPlan: string
subscriptionExpiry: Firestore timestamp, date string, or date milliseconds
access: {
  module-id: true
}
```

A published module is accessible only when all three conditions are true:

```text
subscriptionStatus == "active"
subscriptionExpiry is a future date
access[moduleId] == true
```

An access value that is false or missing locks that module. A past expiry or
`subscriptionStatus == "expired"` locks all published modules and shows
`Subscription expired`.

Users with `role == "Admin"` can access every published module regardless of
subscription fields or the access map. Access values support both booleans and
their lowercase string equivalents: `true`, `"true"`, `false`, and `"false"`.

## Admin Panel v2

Admin pages use Firestore and read the role from `users/{uid}.role`.

```text
SuperAdmin: all admin pages with write access
Admin: Users, Modules, and Access
Editor: Modules and Lessons
Viewer: all admin pages, read-only
Student: no admin access
```

Modules are saved to `modules/{moduleId}`. Lessons are saved to
`modules/{moduleId}/lessons/{lessonId}`. User module access is saved to the
`access` map on `users/{uid}`.

## LMS Admin CMS v1

The Modules and Lessons admin pages support Firestore publishing states and
Firebase Storage uploads. Legacy `published`, `order`, and `path` fields are
still written so existing LMS pages and progress tracking remain compatible.

Student module visibility:

```text
published: visible; normal subscription/access rules apply
coming-soon: visible and locked
improvement: visible with an In Improvement badge
draft: hidden
archived: hidden
```

Only lessons with `status == "published"` appear in student lesson lists.
Draft, hidden, improvement, and archived lessons remain visible in the admin
Lesson Manager only.

Storage paths:

```text
modules/{moduleId}/thumbnail/{filename}
modules/{moduleId}/lessons/{lessonId}/video/{filename}
modules/{moduleId}/lessons/{lessonId}/html/{filename}
modules/{moduleId}/lessons/{lessonId}/resources/{filename}
```

The CMS prefixes uploaded filenames with a timestamp to avoid accidental
overwrites. It stores both the Storage path and download URL in Firestore.

### Required Firebase rules

Do not paste these blindly over existing rules. Merge them with the existing
login, subscription, access, and progress rules in Firebase Console or your
Firebase deployment configuration.

Firestore rules need role helpers and must allow module writes only to
SuperAdmin, Admin, and Editor; lesson writes only to SuperAdmin and Editor;
Viewer and Student must remain read-only for CMS content.

```text
function signedIn() {
  return request.auth != null;
}

function role() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}

function isSuperAdmin() {
  return signedIn() && role() == "SuperAdmin";
}

function canWriteModules() {
  return signedIn() && role() in ["SuperAdmin", "Admin", "Editor"];
}

function canWriteLessons() {
  return signedIn() && role() in ["SuperAdmin", "Editor"];
}

match /modules/{moduleId} {
  allow read: if signedIn();
  allow create, update: if canWriteModules();
  allow delete: if false;

  match /lessons/{lessonId} {
    allow read: if signedIn();
    allow create, update: if canWriteLessons();
    allow delete: if false;
  }
}
```

Storage rules need the equivalent role checks. Storage uploads are limited to
the CMS module tree and destructive deletes are disabled because CMS content is
archived instead of deleted.

```text
function signedIn() {
  return request.auth != null;
}

function role() {
  return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role;
}

function canWriteModules() {
  return signedIn() && role() in ["SuperAdmin", "Admin", "Editor"];
}

function canWriteLessons() {
  return signedIn() && role() in ["SuperAdmin", "Editor"];
}

match /modules/{moduleId}/thumbnail/{fileName} {
  allow read: if signedIn();
  allow create, update: if canWriteModules();
  allow delete: if false;
}

match /modules/{moduleId}/lessons/{lessonId}/{folder}/{fileName} {
  allow read: if signedIn();
  allow create, update: if canWriteLessons()
    && folder in ["video", "html", "resources"];
  allow delete: if false;
}
```

## Dynamic Lesson Viewer

Firestore-created lessons open in the dynamic viewer when they do not have an
existing static lesson `path`:

```text
lesson-view.html?moduleId={moduleId}&lessonId={lessonId}
```

Example:

```text
lesson-view.html?moduleId=meta-advertising-andromeda2026&lessonId=lesson-2
```

The viewer reads:

```text
modules/{moduleId}
modules/{moduleId}/lessons/{lessonId}
modules/{moduleId}/lessons
users/{uid}
progress/{uid}/lessons/{lessonId}
progress/{uid}/modules/{moduleId}/lessons/{lessonId}
```

Supported lesson content fields:

```text
lessonContentType: html | video | slide-deck | mixed
youtubeUrl
videoUrl / videoPath
htmlFileUrl / htmlFilePath
lessonContentHtml
resourceUrl / resourcePath
quizId
```

The viewer renders YouTube embeds, HTML5 video, uploaded HTML in a sandboxed
iframe, sanitized inline lesson HTML, resource links, and a quiz link. The quiz
link targets `quiz.html`, but a quiz engine is not included yet.

Student behavior:

```text
- Requires an active, unexpired subscription and access[moduleId] == true.
- Can open published lessons only.
- Cannot open draft, archived, or coming-soon modules.
```

SuperAdmin, Admin, and Editor can preview all module and lesson statuses without
subscription access. Viewer can see all statuses but still follows normal
subscription and module access checks.

The viewer uses the existing progress service, so Mark Complete continues to
write both the legacy and module-scoped progress paths. Firestore rules must
allow authenticated users to read module and lesson documents and allow users
to read/write their own progress documents. Storage rules must allow
authenticated reads for the lesson files referenced by `videoUrl`,
`htmlFileUrl`, and `resourceUrl`.
