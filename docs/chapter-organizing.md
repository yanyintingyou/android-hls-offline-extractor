# Organizing outputs by chapter

The cache metadata usually does not contain chapter names. This guide describes a repeatable way to group finished MP4 files by textbook chapter without changing the decryption pipeline.

## What the cache contains

A `_log` file normally includes `course_id`, `course_section_id`, `group_name`, `video_id`, `video_name`, `duration`, and `url`. `course_section_id` is unique per video in the caches seen so far, and `group_name` is often empty. Treat the cache as a source of video-level metadata, not as a chapter index.

## Use the textbook table of contents

1. Read the chapter list from the official textbook PDF bookmarks. The bookmark titles are usually the authoritative chapter names and order.
2. Compare that list with the video order. Most courses follow the textbook sequence.
3. Split at chapter summaries. A video named like "chapter summary" normally ends its chapter.
4. Check that every video is assigned exactly once and that the number of videos per chapter is plausible.

## Suggested layout

```text
<output>/<course>/
  00_intro-and-changes/
    01_<video_id>_<title>.mp4
  Chapter 01_<chapter name>/
    01_<video_id>_<title>.mp4
    ...
    08_<video_id>_chapter summary.mp4
  Chapter 02_<chapter name>/
    ...
```

- Use two-digit chapter and order numbers so file managers sort correctly.
- Keep `video_id` in the file name. It is the stable key for deduplication and traceability.
- Keep the chapter summary as the last file in its chapter. A separate "summaries" folder makes review harder.
- Put course introduction, textbook-change notes, and other non-chapter videos in `00_intro-and-changes`. Do not guess a chapter when the file name has no chapter label.

## Keep the mapping local

Maintain a local JSON map with fields such as `chapter`, `order`, `video_id`, `name`, and `file`, plus a CSV index for human browsing. Both contain real course and video IDs and belong in the local workspace, not in this repository. `.gitignore` covers the common names.

## Validation

- Assign every video once; compare chapter counts with the textbook and the course total.
- Run `verify_output.js` with the same `OUT` and `TARGET_COURSES` values used for processing.
- Run `batch_process.js` again. It searches subfolders recursively by `video_id`, so organized files are skipped instead of re-encoded.
- Decode one or two outputs for 60 seconds with ffmpeg to catch container or stream problems.

## Gotchas

- Later-added videos can have higher IDs than the chapter summary. Insert them before the summary according to their topic.
- Some chapters have no summary video. Do not create a placeholder.
- Do not change the filename sanitize rules. Existing-output detection and re-runs rely on stable names.
- Review the list of changed textbook sections separately. Those videos are often named generically and may need manual placement.
