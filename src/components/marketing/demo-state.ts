export interface DemoAuditResult {
  reportHref: string
  label: string
}

export type DemoAuditState =
  | { status: "idle" }
  | { status: "submitting"; message: string }
  | { status: "error"; message: string }
  | { status: "result"; result: DemoAuditResult }

export type DemoAuditAction =
  | { type: "submit" }
  | { type: "reject"; message: string }
  | { type: "resolve"; result: DemoAuditResult }
  | { type: "reset" }

export const initialDemoAuditState: DemoAuditState = { status: "idle" }

export function demoAuditReducer(_state: DemoAuditState, action: DemoAuditAction): DemoAuditState {
  switch (action.type) {
    case "submit":
      return { status: "submitting", message: "Website wird geprüft …" }
    case "reject":
      return { status: "error", message: action.message }
    case "resolve":
      return { status: "result", result: action.result }
    case "reset":
      return initialDemoAuditState
  }
}

export interface DemoFormState {
  audit: DemoAuditState
  turnstileToken: string | null
  turnstileResetVersion: number
}

export type DemoFormAction =
  | { type: "turnstile_token"; token: string | null }
  | { type: "submit" }
  | { type: "validation_error"; message: string }
  | { type: "submit_error"; message: string }
  | { type: "resolve"; result: DemoAuditResult }
  | { type: "reset_audit" }

export const initialDemoFormState: DemoFormState = {
  audit: initialDemoAuditState,
  turnstileToken: null,
  turnstileResetVersion: 0,
}

export function demoFormReducer(state: DemoFormState, action: DemoFormAction): DemoFormState {
  switch (action.type) {
    case "turnstile_token":
      return { ...state, turnstileToken: action.token }
    case "submit":
      return { ...state, audit: demoAuditReducer(state.audit, action) }
    case "validation_error":
      return {
        ...state,
        audit: demoAuditReducer(state.audit, { type: "reject", message: action.message }),
      }
    case "submit_error":
      return {
        audit: demoAuditReducer(state.audit, { type: "reject", message: action.message }),
        turnstileToken: null,
        turnstileResetVersion: state.turnstileResetVersion + 1,
      }
    case "resolve":
      return { ...state, audit: demoAuditReducer(state.audit, action) }
    case "reset_audit":
      return { ...state, audit: initialDemoAuditState }
  }
}
