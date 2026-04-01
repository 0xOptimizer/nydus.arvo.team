'use client'

export const RippleButton = ({ children, onClick, className = '', disabled = false, variant = 'primary' }: any) => {
    const createRipple = (event: any) => {
        const button = event.currentTarget
        const circle = document.createElement('span')
        const diameter = Math.max(button.clientWidth, button.clientHeight)
        const radius = diameter / 2
        const rect = button.getBoundingClientRect()
        circle.style.width = circle.style.height = `${diameter}px`
        circle.style.left = `${event.clientX - rect.left - radius}px`
        circle.style.top = `${event.clientY - rect.top - radius}px`
        circle.classList.add('ripple')
        const existing = button.getElementsByClassName('ripple')[0]
        if (existing) existing.remove()
        button.appendChild(circle)
        if (onClick) onClick(event)
    }

    const baseStyle = "relative overflow-hidden transition-all duration-200 px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
    const variants: any = {
        primary: "bg-primary text-black hover:bg-primary/90",
        danger: "bg-red-900/50 text-red-200 hover:bg-red-900/70 border border-red-700/50",
        warning: "bg-yellow-900/50 text-yellow-200 hover:bg-yellow-900/70 border border-yellow-700/50",
        outline: "bg-secondary text-foreground border border-border hover:bg-border",
        ghost: "bg-transparent text-foreground border border-border hover:bg-secondary",
        pma: "bg-orange-900/50 text-orange-200 hover:bg-orange-900/70 border border-orange-700/50",
    }

    return (
        <button disabled={disabled} onClick={createRipple} className={`${baseStyle} ${variants[variant]} ${className}`}>
            <span className="relative z-10">{children}</span>
            <style jsx global>{`
                span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: rgba(255, 255, 255, 0.3); pointer-events: none; }
                @keyframes ripple { to { transform: scale(4); opacity: 0; } }
            `}</style>
        </button>
    )
}