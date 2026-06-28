import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL must be set in the environment')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers?.authorization ?? ''
  const [, token] = authHeader.split(' ')

  if (!token) {
    return res.status(401).json({ error: 'Authorization token is required' })
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session or expired token' })
    }

    const userId = userData.user.id
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message ?? 'Failed to delete user' })
    }

    return res.status(200).json({ message: 'Conta excluída com sucesso' })
  } catch (error) {
    console.error('delete-account error:', error)
    return res.status(500).json({ error: 'Erro interno ao excluir a conta' })
  }
}
