"use client"

import { useEffect, useRef, useState } from "react"

const IMG_SRC = "https://i.imgur.com/xFtYW9x.png"

export default function NydusEasterEgg() {
    const clickCount = useRef(0)
    const clickTimer = useRef<NodeJS.Timeout | null>(null)
    const [phase, setPhase] = useState<"idle" | "peek" | "launch">("idle")

    useEffect(() => {
        const el = document.querySelector(".nydus-title")
        if (!el) return

        const handleClick = () => {
            clickCount.current += 1

            if (clickTimer.current) clearTimeout(clickTimer.current)

            clickTimer.current = setTimeout(() => {
                clickCount.current = 0
            }, 2000)

            if (clickCount.current === 5) {
                clickCount.current = 0
                runSequence()
            }
        }

        el.addEventListener("click", handleClick)
        return () => el.removeEventListener("click", handleClick)
    }, [])

    const runSequence = async () => {
        // setPhase("peek")
        // await wait(1000)
        // setPhase("idle")
        // await wait(300)
        // setPhase("peek")
        // await wait(500)
        setPhase("launch")
        await wait(2000)
        setPhase("idle")
    }

    const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

    return (
        <>
            {phase !== "idle" && (
                <img
                    src={IMG_SRC}
                    className={`fixed top-1/2 -translate-y-1/2 w-32 pointer-events-none z-[9999]
                    ${phase === "peek" ? "nydus-peek" : ""}
                    ${phase === "launch" ? "nydus-launch" : ""}`}
                    alt="easter egg"
                />
            )}

            <style jsx global>{`
                .nydus-peek {
                    animation: nydusPeek 1s ease forwards;
                }

                .nydus-launch {
                    animation: nydusLaunch 2s cubic-bezier(.25,.75,.5,1) forwards;
                }

                @keyframes nydusPeek {
                    0%   { left: -60px; transform: translateY(-50%) rotate(0deg); }
                    50%  { left: 0px; }
                    100% { left: -60px; }
                }

                @keyframes nydusLaunch {
                    0% {
                        left: -120px;
                        transform: translateY(-50%) rotate(0deg);
                    }
                    20% {
                        left: 10vw;
                        top: 40%;
                        transform: rotate(360deg);
                    }
                    50% {
                        left: 50vw;
                        top: 10%;
                        transform: rotate(1440deg);
                    }
                    80% {
                        left: 80vw;
                        top: 60%;
                        transform: rotate(2160deg);
                    }
                    100% {
                        left: 110vw;
                        top: 50%;
                        transform: rotate(2880deg);
                    }
                }
            `}</style>
        </>
    )
}