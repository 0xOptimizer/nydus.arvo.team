"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, LabelList,
  Pie, PieChart, XAxis, YAxis
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCloudflareAnalytics } from "@/app/actions/cloudflare"
import { formatDate } from "@/lib/utils"

const chartConfig = {
  visitors: { label: "Visitors", color: "var(--primary)" },
  bandwidth_gb: { label: "Bandwidth (GB)", color: "var(--primary)" },
  desktop: { label: "Desktop", color: "var(--primary)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
  tablet: { label: "Tablet", color: "var(--chart-3)" },
  label: { color: "var(--background)" },
} satisfies ChartConfig

function DashboardContent() {
  const [data, setData] = React.useState<any[]>([])
  const [range, setRange] = React.useState("1")
  const [granularity, setGranularity] = React.useState("daily")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(false)
    async function fetchData() {
      setLoading(true)
      try {
        const response = await getCloudflareAnalytics(Number(range))
        if (response && response.data) {
          response.data.forEach((item: any) => {
            item.timestamp = formatDate(item.timestamp)
          })
          setData(response.data)
          setGranularity(response.granularity)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [range])

  const aggregateBarData = (key: string) => {
    const counts: Record<string, number> = {}
    data.forEach(item => {
      const source = item[key] || {}
      Object.entries(source).forEach(([name, value]) => {
        counts[name] = (counts[name] || 0) + (value as number)
      })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({
        label: name,
        visitors: value,
      }))
      .sort((a, b) => b.visitors - a.visitors)
  }

  const deviceData = React.useMemo(() => {
    const totals = { desktop: 0, mobile: 0, tablet: 0 }
    data.forEach(d => {
      if (d.devices) {
        totals.desktop += (d.devices.desktop || 0)
        totals.mobile += (d.devices.mobile || 0)
        totals.tablet += (d.devices.tablet || 0)
      }
    })
    return [
      { browser: "desktop", visitors: totals.desktop, fill: "var(--primary)" },
      { browser: "mobile", visitors: totals.mobile, fill: "var(--chart-2)" },
      { browser: "tablet", visitors: totals.tablet, fill: "var(--chart-3)" },
    ].filter(d => d.visitors > 0)
  }, [data])

  const formatDate = (value: string) => {
    const date = new Date(value)
    return granularity === "hourly"
      ? date.toLocaleTimeString("en-US", { hour: "numeric" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const totalVisitors = React.useMemo(() => data.reduce((acc, curr) => acc + (curr.visitors || 0), 0), [data])

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">Cloudflare Analytics</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px] bg-card border-border text-card-foreground">
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem
              value="1"
              className="focus:bg-secondary focus:text-primary-foreground cursor-pointer"
            >
              Last 24 Hours
            </SelectItem>
            <SelectItem
              value="7"
              className="focus:bg-secondary focus:text-primary-foreground cursor-pointer"
            >
              Last 7 Days
            </SelectItem>
            <SelectItem
              value="30"
              className="focus:bg-secondary focus:text-primary-foreground cursor-pointer"
            >
              Last 30 Days
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-transparent border-zinc-800 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="grid gap-1">
            <CardTitle className="text-base font-medium text-white">Unique Visitors</CardTitle>
            <CardDescription className="text-zinc-400">
              Showing traffic trends for the selected period
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total</span>
            <span className="text-3xl font-black tabular-nums text-white">
              {totalVisitors.toLocaleString()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
            <AreaChart data={data} margin={{ left: -20, right: 20, top: 20, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              >
                {/* <Label
                  value="Visitors"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle", fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                /> */}
              </YAxis>
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Area
                dataKey="visitors"
                type="monotone"
                fill="var(--primary)"
                fillOpacity={0.15}
                stroke="var(--primary)"
                strokeWidth={1}
                activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-transparent border-zinc-800">
          <CardHeader className="pb-0">
            <CardTitle className="text-white text-center">Device Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={deviceData}
                  dataKey="visitors"
                  nameKey="browser"
                  innerRadius={75}
                  outerRadius={100}
                  paddingAngle={8}
                  stroke="none"
                >
                  {deviceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#0f9" : "#18181b"}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}

                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-white text-2xl font-bold">
                              {deviceData.reduce((acc, curr) => acc + curr.visitors, 0)}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-zinc-500 text-xs uppercase tracking-widest">
                              Total
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {deviceData.map((entry, index) => (
                <div key={entry.browser} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: index === 0 ? "#0f9" : "#27272a" }}
                  />
                  <span className="text-[10px] uppercase font-bold text-zinc-400">
                    {entry.browser}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader><CardTitle className="text-white">Top Countries</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={aggregateBarData("countries")} layout="vertical" margin={{ left: 0, right: 60 }}>
                <YAxis dataKey="label" type="category" hide />
                <XAxis type="number" hide />
                <Bar dataKey="visitors" fill="var(--primary)" radius={4}>
                  <LabelList dataKey="label" position="insideLeft" className="fill-black font-bold" fontSize={14}/>
                  <LabelList dataKey="visitors" position="right" className="fill-zinc-400" fontSize={14}/>
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-transparent border-zinc-800">
        <CardHeader><div className="grid gap-1">
            <CardTitle className="text-base font-medium text-white">Bandwidth</CardTitle>
            <CardDescription className="text-zinc-400">
              In gigabytes (GB)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
            <AreaChart data={data} margin={{ left: -40, right: 20, top: 20, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatDate} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              >
                {/* <Label
                  value="Gigabytes"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle", fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                /> */}
              </YAxis>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="bandwidth_gb" type="monotone" fill="transparent" stroke="var(--primary)" strokeWidth={1} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader><CardTitle className="text-white">Top Countries</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={aggregateBarData("browsers")} layout="vertical" margin={{ left: 0, right: 60 }}>
                <YAxis dataKey="label" type="category" hide />
                <XAxis type="number" hide />
                <Bar dataKey="visitors" fill="var(--primary)" radius={4}>
                  <LabelList dataKey="label" position="insideLeft" className="fill-black font-bold" fontSize={14}/>
                  <LabelList dataKey="visitors" position="right" className="fill-zinc-400" fontSize={14}/>
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader><CardTitle className="text-white">Top Countries</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={aggregateBarData("os")} layout="vertical" margin={{ left: 0, right: 60 }}>
                <YAxis dataKey="label" type="category" hide />
                <XAxis type="number" hide />
                <Bar dataKey="visitors" fill="var(--primary)" radius={4}>
                  <LabelList dataKey="label" position="insideLeft" className="fill-black font-bold" fontSize={14}/>
                  <LabelList dataKey="visitors" position="right" className="fill-zinc-400" fontSize={14}/>
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const DashboardPage = dynamic(() => Promise.resolve(DashboardContent), { ssr: false })
export default DashboardPage