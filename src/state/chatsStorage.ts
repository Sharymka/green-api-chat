export interface SavedChat {
  chatId: string
  name?: string
}

// Список чатов храним в localStorage: он переживает и перезагрузку, и закрытие браузера.
// У каждого инстанса свой список, чтобы при входе с другим инстансом не видеть чужие чаты.
// Сами сообщения сюда не пишем — их отдаёт getChatHistory.

function key(idInstance: string): string {
  return `green-api-chat:chats:${idInstance}`
}

export function loadChats(idInstance: string): SavedChat[] {
  try {
    const raw = localStorage.getItem(key(idInstance))
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('chatId' in item)) return []
      if (typeof item.chatId !== 'string') return []
      const name = 'name' in item && typeof item.name === 'string' ? item.name : undefined
      return [{ chatId: item.chatId, name }]
    })
  } catch {
    return []
  }
}

export function saveChats(idInstance: string, chats: SavedChat[]): void {
  try {
    const data = chats.map(({ chatId, name }) => ({ chatId, name }))
    localStorage.setItem(key(idInstance), JSON.stringify(data))
  } catch {
    // Не сохранилось — после перезагрузки список чатов будет пустым, но работать можно
  }
}

export function clearChats(idInstance: string): void {
  try {
    localStorage.removeItem(key(idInstance))
  } catch {
    // Нечего делать: хранилище недоступно, значит, и стирать нечего
  }
}
