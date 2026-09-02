<!-- ripple:process:start -->
## Ripple Process
This repo is connected to [Ripple](https://github.com/) as a todo tracker. Each open issue with
one of the `ai:*` labels below is a queued piece of work - treat it like a ticket from a
teammate, not a suggestion.

**Labels drive status** - set exactly one of these on an issue as your state changes, replacing
whichever one was there before:
- `ai:in-progress` - apply this the moment you start working the issue.
- `ai:awaiting-user` - apply this if you have a question and need a person to answer before you
  can continue. Post the question as a comment (see below).
- `ai:ready-for-testing` - apply this once you believe the work is complete and ready for a human
  to verify. Post a short summary comment of what you did.

**Priority** (`priority:high`/`priority:medium`/`priority:low`, if present) reflects how
urgently this should be worked relative to other open issues in this repo - no label means normal/
low priority.

**Comments are the question/answer channel** - prefix every comment you post with
`**[Ripple AI]**` (exactly that, at the start of the comment) so Ripple recognizes it as
part of the thread it shows the user. A reply from the user will be prefixed `**[Ripple]**`
and the label will be flipped back to `ai:in-progress` - that's your cue to look again. Do not
treat an unprefixed comment on the issue as part of this conversation; someone may be discussing the
issue for unrelated reasons.

**Do not close the issue yourself.** Once you've applied `ai:ready-for-testing`, a person reviews
your work and either closes it themselves ("Mark complete") or sends it back with a note (which
reopens the `ai:in-progress` cycle above). Closing it yourself skips that review step.

**Test/prod boundaries**, if this project sets any (see below/the issue body), are a convention
communicated through text, not something Ripple enforces technically - follow them the same as any
other instruction in this issue.
<!-- ripple:process:end -->

<!-- ripple:custom:start -->
## Ripple Custom

<!-- ripple:custom:end -->

<!-- ripple:project:start -->
## Ripple Project Specific

<!-- ripple:project:end -->
