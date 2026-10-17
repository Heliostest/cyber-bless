# 剑玉轻接

`japanese-kendama` / `japanese-kendama-craft` is an original Japanese cup-and-ball appreciation scene. Primary references and boundaries are in `content/traditions/japanese-kendama-craft.md`.

Three direct upward60px handle drags lift the ball into the large cup, transfer it to the small cup, then align the socket over the spike. Each toss first clears the receiving surface before the handle turns. The pointer represents a hand holding the wooden ken. The toy starts and finishes on a cloth; no display furniture or invisible hit proxy. Concave cups fit the ball's sphere, and the open socket's internal stop meets the spike. The string stays attached at both ends and reuses its geometry buffer. Ball paint uses three material batches rather than one draw per face.

Assisted trajectories/string shape illustrate timing and orientation; they are not full collision/tension physics, complete technique instruction or grading. Original proportions and paint, no copied media or association marks. No wish form, efficacy claim or entry sound. Optional feedback is a quiet acceptance tone.

Input ownership, invalid gestures, interruptions, callback reentry and disposal use the established scene lifecycle. Reduced motion, keyboard and silent checkpoints0–3 reach the same poses. Real geometry tests cover cup contact, socket/spike seating, grounded starting pose, string endpoints, all-vertex framing and stable buffers. Browser evidence is saved in ignored `artifacts/japanese-kendama/`.
