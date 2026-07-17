import { eveChannel } from "eve/channels/eve"
import { httpBasic, localDev, vercelOidc, type AuthFn } from "eve/channels/auth"

function internalServicePrincipal(): AuthFn<Request> {
  return async (request) => {
    const username = process.env.EVE_RUNTIME_SERVICE_USERNAME?.trim()
    const password = process.env.EVE_RUNTIME_SERVICE_PASSWORD?.trim()
    if (!username || !password) return null
    return httpBasic({ username, password })(request)
  }
}

export default eveChannel({
  auth: [internalServicePrincipal(), vercelOidc(), localDev()],
})
