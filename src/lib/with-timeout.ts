export function withTimeout<T>(promiseFactory: () => Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error(timeoutMessage))
      }
    }, timeoutMs)

    const clear = () => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
      }
    }

    Promise.resolve()
      .then(() => promiseFactory())
      .then((value) => {
        clear()
        resolve(value)
      })
      .catch((error) => {
        clear()
        reject(error)
      })
  })
}
