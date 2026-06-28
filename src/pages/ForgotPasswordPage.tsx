import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Mic, Check } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center shadow-xl mb-3">
          <Mic size={30} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6]">VozZap</h1>
      </div>

      <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1C] rounded-3xl shadow-xl p-6">
        {!sent ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6] mb-2">Recuperar senha</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#25D366] hover:bg-[#075E54] disabled:bg-gray-300 text-white rounded-xl py-3.5 font-semibold transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Enviar link de recuperação'
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-white" />
            </div>
            <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6] text-lg mb-2">Email enviado!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-sm text-[#25D366] hover:text-[#075E54] font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
