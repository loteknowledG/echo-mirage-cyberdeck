# Call Station — AI matchmaker (pairing only)

Dream → first slice: durable **waiting rooms** + MUTHUR tools that answer “who’s waiting / where’s the room?”

## Idea

- **Store** = law (rooms, codes, TTL)
- **AI** = receptionist (reads the store, speaks naturally)
- **Spin-up OK** — state in file (local) or Upstash (Vercel / multi-instance)

Not a live WebRTC hub. Pairing / matchmaking only.

## HTTP

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/api/call-station/rooms?lookingFor=echo\|mirage\|powerfist\|any` | list waiting |
| POST | `/api/call-station/rooms` | `{ "action": "open", "waitingAs": "echo", "label": "…" }` |
| POST | `/api/call-station/rooms` | `{ "action": "match", "lookingFor": "mirage" }` |

## MUTHUR tools

| Tool | Use |
|------|-----|
| `call_station_who_is_waiting` | “Anyone waiting?” |
| `call_station_open_room` | “I’m Echo — open a room” |
| `call_station_match` | “Find me a Mirage” (or open one if empty) |
| `call_station_find_room` | “Where is room K7M2?” |

## Try

1. Dev server up  
2. Ask MUTHUR: *open a call station room as echo*  
3. Ask (same or other session): *who is waiting on the call station?*  
4. Or curl:

```bash
curl -X POST http://127.0.0.1:3050/api/call-station/rooms -H "content-type: application/json" -d "{\"action\":\"open\",\"waitingAs\":\"echo\",\"label\":\"capture desk\"}"
curl "http://127.0.0.1:3050/api/call-station/rooms?lookingFor=echo"
```

## Storage

- Default: `.tmp/call-station-rooms.json`
- Upstash when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set (key `call-station:rooms`)
