import { getMembers } from './members.get'
import { getAllFollows, getIsLive, getOnlives, getRoomStatus, getStreamingURL } from '~~/library/api/showroom'
import config from '~~/app.config'
import cache from '~~/library/utils/cache'

export default defineEventHandler(async (event): Promise<IRoomLive[]> => {
  const query = getQuery(event)
  const group = config.getGroup(query.group as string)
  return await getNowLive(group)
})
const time = 5000
async function getNowLive(group: string | null = null): Promise<IRoomLive[]> {
  return await cache
    .fetch<IRoomLive[]>(group ? `${group}-now_live` : 'now_live', () => getNowLiveCookies(null, group), time)
}

async function getNowLiveDirect(
  membersData: IMember[] | null = null,
  group: string | null = null,
): Promise<IRoomLive[]> {
  const members: IMember[] = membersData ?? await getMembers(group)
  const promises: Promise<IRoomLive | null>[] = []
  for (const member of members) {
    promises.push(
      (async (): Promise<IRoomLive | null> => {
        try {
          const data = await getIsLive(member.room_id)
          if (!data.ok) return null // if 'ok',this room is on live
          const status = await getRoomStatus({ room_url_key: member.url.startsWith('/') ? member.url.slice(1) : member.url })
          const streamURLS = await getStreamingURL({ room_id: member.room_id })
          return {
            name: member.name,
            img: member.img,
            img_alt: member.img_alt,
            url: member.url,
            room_id: member.room_id,
            is_graduate: member.is_graduate,
            is_group: member.is_group,
            room_exists: member.room_exists,
            started_at: (status.started_at ?? 0) * 1000,
            streaming_url_list: streamURLS.streaming_url_list ?? [],
          }
        }
        catch (e) {
          return null
        }
      })(),
    )
  }
  const data = await Promise.all(promises)
  return data.filter(i => i) as IRoomLive[]
}

async function getNowLiveCookies(membersData: IMember[] | null = null, group: string | null = null): Promise<IRoomLive[]> {
  const members: IMember[] = membersData ?? await getMembers(group)
  const rooms = await getAllFollows().catch(_ => [])
  const roomMap = new Map<string, ShowroomAPI.RoomFollow>()
  const result: Promise<IRoomLive>[] = []
  const missing = []

  for (const room of rooms) {
    roomMap.set(room.room_id, room)
  }

  for (const member of members) {
    const room = roomMap.get(String(member.room_id))
    if (room) {
      if (room.is_online) {
        let isPremium = false
        result.push((async () => {
          const streamURLS = await getStreamingURL({ room_id: room.room_id }).catch((e) => {
            return {
              streaming_url_list: [],
            }
          })
          const RoomStatus = await getRoomStatus({ room_url_key: room.room_url_key }).catch((e: any) => {
            if (e.data.errors && e.data.errors[0]?.redirect_url) {
              isPremium = true
            }
          })
          return {
            name: room.room_name,
            img: room.image_l,
            img_alt: member.img_alt,
            url: room.room_url_key,
            room_id: Number(room.room_id),
            started_at: (RoomStatus?.started_at ?? 0) * 1000,
            is_graduate: member.is_graduate,
            is_group: member.is_group,
            room_exists: member.room_exists,
            streaming_url_list: streamURLS.streaming_url_list ?? [],
            is_premium: isPremium,
          }
        })())
      }
    }
    else if (member.room_exists) {
      missing.push(member)
    }
  }

  const lives = []
  lives.push(...await Promise.all(result))
  if (missing.length) {
    lives.push(...await getNowLiveDirect(missing))
  }
  return lives
}

async function getNowLiveIndirect(membersData: IMember[] | null = null): Promise<IRoomLive[]> {
  const members: IMember[] = membersData ?? await getMembers()
  const memberMap = new Map<string | number, IMember>()
  for (const member of members) {
    memberMap.set(member.room_id, member)
  }

  const res = await getOnlives()
  const all: ShowroomAPI.OnlivesRoom[] = res.onlives.reduce((a: any, b: any) => {
    a.push(...b.lives)
    return a
  }, [])

  const result: IRoomLive[] = []
  for (const room of all) {
    const member = memberMap.get(room.room_id)
    if (member) {
      result.push({
        name: room.main_name,
        img: room.image,
        img_alt: member.img_alt,
        url: room.room_url_key,
        room_id: room.room_id,
        started_at: (room.started_at ?? 0) * 1000,
        is_graduate: member.is_graduate,
        is_group: member.is_group,
        room_exists: member.room_exists,
        streaming_url_list: room.streaming_url_list ?? [],
      })
    }
  }

  return result
}

export { getNowLive, getNowLiveDirect, getNowLiveIndirect, getNowLiveCookies }
