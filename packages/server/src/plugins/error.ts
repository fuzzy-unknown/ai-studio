import { Elysia } from 'elysia'

export const errorPlugin = new Elysia({ name: 'plugin:error' })
  .onError(({ code, error, status }) => {
    switch (code) {
      case 'VALIDATION':
        return status(400, {
          error: 'Validation Error',
          details: error.all.map(e => e.message),
        })
      case 'NOT_FOUND':
        return status(404, { error: 'Not Found' })
      case 'UNKNOWN':
        console.error('[ERROR] Unhandled:', error)
        return status(500, { error: 'Internal Server Error' })
      default:
        return status(500, { error: String(error) })
    }
  })
  .as('global')
