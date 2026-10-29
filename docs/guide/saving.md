# Saving

## Per-file memory

aures remembers each song on its own. Reopen the same audio and its markers, loop and speed come back by themselves. They live in the browser (`localStorage`), so they belong to this browser on this machine.

## Take them with you

Press **Save**, or `S`, to download a small `.aures.json` file. Keep it next to your audio; drop it on the page on another machine and the markers come back.

- It only loads back onto the same audio. The file records the size and duration of the track it came from, and refuses to import onto anything else, because the times would mean nothing against a different cut of the song
- Renaming the audio file is fine: the name is not part of the check
