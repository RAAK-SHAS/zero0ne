I do have an idea, and the screenshot gives a strong clue: the upload is failing immediately at 6 MB / 6.33 GB with “File exceeds the server upload limit”, while the UI still says “Upload Complete”. That means two things need fixing: the server/bucket limit must be raised, and the frontend should stop treating a failed upload as complete.

Plan:

1. Update the backend storage bucket limit
   - Use the backend tool to set the `user-files` bucket max file size to 50GB or 64GB.
   - This is the likely real blocker for 6GB uploads.

2. Fix misleading “Upload Complete” UI
   - Change the summary title so any failed upload shows an error state, never “Upload Complete”.
   - Keep the failed filename and exact reason visible.

3. Stop useless retries for 413/global-limit failures
   - Keep 413 errors final instead of retrying.
   - Disable “Retry all failed” for known server-size-limit errors because retrying cannot help until the backend limit is fixed.

4. Make diagnostics easier to see
   - Show the failing request step, HTTP status, server response, bytes uploaded, and whether it failed during TUS creation or chunk upload directly in the failed-upload details.
   - Keep copy-to-clipboard diagnostics available.

5. Clean stale stuck upload states
   - Ensure uploads restored without a local file are paused/reselect-needed, not counted as actively uploading.
   - Ensure error uploads are not counted as in-progress.

Expected result:
- If the backend limit is fixed, a 6GB upload should proceed in 6MB resumable chunks.
- If the backend still rejects it, the UI will clearly say the exact failing request step and 413/global-limit response instead of hiding it behind “Upload Complete” or endless retries.