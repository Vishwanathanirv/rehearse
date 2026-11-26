# Rehearse · Spec

## Problem
Candidates rehearse by reading answers, then freeze when speaking to a judge. Question banks don't talk back; friends go easy.

## Core (MVP)
A spoken interview that listens, follows up on what you missed, and gives a hiring-panel verdict.

## Flow
1. Home → Start an interview (guest session, no sign-up)
2. Setup: role (13), level (4), type (technical, behavioural, mixed), length
3. Lobby: camera and microphone check
4. Room: question spoken → answer out loud → end-of-turn detection → reaction or follow-up → next
5. Closing: candidate's questions, spoken verdict
6. Report: panel call, per-answer scores, delivery metrics, print
7. Practice log: history against the bar, per-topic skill estimate with range

## Data
| Table | Columns |
| --- | --- |
| users | id, email, name, password_hash (null for guests), is_guest, created_at |
| interviews | id, user_id → users, role, level, focus, total_questions, status, provider, current_question, overall_score, report, targets, created_at, completed_at |
| turns | per answer: question, transcript, scores, evaluation, voice and video summaries |

## API
| Route | Limit |
| --- | --- |
| POST /api/auth/guest · signup · login · logout | 10/min/IP (login also 5/min/email) |
| POST /api/interviews | 10/hour/user |
| POST /api/interviews/:id/answer | 30/min/user |
| POST /api/interviews/:id/closing · debrief | 10/min/user |
| POST /api/tts | 80/hour/user |

## States
- Loading: skeletons on dashboard and report; "Okay." spoken while grading.
- Empty: practice log with no interviews shows one action, Start an interview.
- Errors: AI timeout → rules grader; TTS failure → browser voice; unsupported browser → told to use Chrome or Edge.

## Out of scope
Typed answers, paid voice APIs, uploading audio or video.
