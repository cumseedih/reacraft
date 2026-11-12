import { Alert } from 'react-native'

/**
 * Native confirmation gate for destructive or sensitive actions. This is the
 * mobile equivalent of the web confirmation dialog — it MUST wrap every
 * destructive action (delete project/memory/snapshot, destroy session,
 * confirm a destructive BOT action, apply a patch). The action only runs if
 * the user explicitly taps the confirm button; there is no trusted bypass.
 */
export function confirmDestructive(options: {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmLabel ?? 'Confirm',
          style: options.destructive === false ? 'default' : 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}
