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
import { formatDate as formatDateUtil } from "@/lib/utils"

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

  const countriesChartRef = React.useRef<HTMLDivElement>(null);
  const [countriesChartWidth, setCountriesChartWidth] = React.useState(0);
  const browsersChartRef = React.useRef<HTMLDivElement>(null)
  const [browsersChartWidth, setBrowsersChartWidth] = React.useState(0)
  const osChartRef = React.useRef<HTMLDivElement>(null)
  const [osChartWidth, setOsChartWidth] = React.useState(0)

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await getCloudflareAnalytics(Number(range))
        if (response && response.data) {
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

  React.useEffect(() => {
    if (!countriesChartRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setCountriesChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(countriesChartRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!browsersChartRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setBrowsersChartWidth(entry.contentRect.width)
      }
    })
    observer.observe(browsersChartRef.current)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!osChartRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setOsChartWidth(entry.contentRect.width)
      }
    })
    observer.observe(osChartRef.current)
    return () => observer.disconnect()
  }, [])

  // Memoized aggregations
  const totalVisitors = React.useMemo(
    () => data.reduce((acc, curr) => acc + (curr.visitors || 0), 0),
    [data]
  )

  const deviceData = React.useMemo(() => {
    const totals: Record<string, number> = {}
    data.forEach(d => {
      if (d.devices) {
        Object.entries(d.devices).forEach(([type, count]) => {
          const key = type.toLowerCase()
          totals[key] = (totals[key] || 0) + (count as number)
        })
      }
    })
    return [
      { browser: "desktop", visitors: totals.desktop || 0, fill: "var(--primary)" },
      { browser: "mobile", visitors: totals.mobile || 0, fill: "var(--destructive)" },
      { browser: "tablet", visitors: totals.tablet || 0, fill: "var(--muted)" },
    ].filter(d => d.visitors > 0)
  }, [data])

  const countriesData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(item => {
      const source = item.countries || {}
      Object.entries(source).forEach(([name, value]) => {
        counts[name] = (counts[name] || 0) + (value as number)
      })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, visitors: value }))
      .filter(item => item.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  }, [data])

  const browsersData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(item => {
      const source = item.browsers || {}
      Object.entries(source).forEach(([name, value]) => {
        counts[name] = (counts[name] || 0) + (value as number)
      })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, visitors: value }))
      .filter(item => item.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  }, [data])

  const osData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(item => {
      const source = item.os || {}
      Object.entries(source).forEach(([name, value]) => {
        counts[name] = (counts[name] || 0) + (value as number)
      })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ label: name, visitors: value }))
      .filter(item => item.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  }, [data])

  const formatDate = React.useCallback(
    (value: string) => {
      if (!value) return ""
      const date = new Date(value)
      if (granularity === "hourly") {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      } else if (granularity === "4hourly") {
        return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })
      } else {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      }
    },
    [granularity]
  )

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">Cloudflare Analytics</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px] bg-card border-border text-card-foreground">
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-popover-foreground">
            <SelectItem value="1" className="focus:bg-secondary focus:text-primary-foreground cursor-pointer">
              Last 24 Hours
            </SelectItem>
            <SelectItem value="3" className="focus:bg-secondary focus:text-primary-foreground cursor-pointer">
              Last 3 Days
            </SelectItem>
            <SelectItem value="7" className="focus:bg-secondary focus:text-primary-foreground cursor-pointer">
              Last 7 Days
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Unique Visitors Chart */}
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
              />
              <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={formatDate} />} />
              <Area
                dataKey="visitors"
                type="monotone"
                fill="var(--primary)"
                fillOpacity={0.15}
                stroke="var(--primary)"
                strokeWidth={2}
                activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Device Distribution & Top Countries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Distribution Pie */}
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
                      fill={entry.fill}
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
              {deviceData.map((entry) => (
                <div key={entry.browser} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="text-[10px] uppercase font-bold text-zinc-400">{entry.browser}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Countries */}
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader>
            <CardTitle className="text-white">Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 1. The Wrapper: Fixed height with scroll overflow */}
            <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              <div ref={countriesChartRef}>
                {/* 2. The Chart: Height is dynamic (e.g., 40px per bar) */}
                <ChartContainer
                  config={chartConfig}
                  className="w-full"
                  style={{ height: `${countriesData.length * 45}px` }}
                >
                  <BarChart
                    data={countriesData}
                    layout="vertical"
                    margin={{ left: 0, right: 60, top: 10, bottom: 10 }}
                  >
                    <YAxis dataKey="label" type="category" hide />
                    <XAxis type="number" hide />
                    <Bar barSize={24} dataKey="visitors" fill="var(--secondary)" radius={4}>
                      <LabelList
                        dataKey="label"
                        content={(props) => {
                          const { x, y, width, height, value } = props;
                          // Offset the flag and text slightly from the left edge
                          const xOffset = (typeof x === 'number' ? x : 0) + 8;
                          const yOffset = (typeof y === 'number' ? y : 0);
                          const centerY = yOffset + (typeof height === 'number' ? height : 0) / 2;

                          return (
                            <g>
                              {/* The Flag Image */}
                              <image
                                href={`https://flagsapi.com/${value}/flat/64.png`}
                                x={xOffset}
                                y={centerY - 10} // Center vertically (assuming 20px height)
                                height="20"
                                width="20"
                                preserveAspectRatio="xMidYMid slice"
                              />

                              <text
                                x={xOffset + 35}
                                y={centerY}
                                dominantBaseline="middle"
                                fill="currentColor"
                                className="fill-primary font-bold"
                                fontSize={12}
                              >
                                {value}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <LabelList
                        dataKey="visitors"
                        content={({ y, height, value }) => {
                          const numericY = typeof y === 'string' ? parseFloat(y) : (typeof y === 'number' ? y : 0);
                          const numericHeight = typeof height === 'string' ? parseFloat(height) : (typeof height === 'number' ? height : 0);
                          const centerY = numericY + numericHeight / 2;
                          const rightEdgeX = (countriesChartWidth || 0) - 30;
                          return (
                            <text
                              x={rightEdgeX}
                              y={centerY}
                              dominantBaseline="middle"
                              textAnchor="end"
                              fill="white"
                              fontSize={14}
                              className="fill-zinc-400 font-bold"
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bandwidth Chart */}
      <Card className="bg-transparent border-zinc-800">
        <CardHeader>
          <div className="grid gap-1">
            <CardTitle className="text-base font-medium text-white">Bandwidth</CardTitle>
            <CardDescription className="text-zinc-400">In gigabytes (GB)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
            <AreaChart data={data} margin={{ left: -40, right: 20, top: 20, bottom: 20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={formatDate} />} />
              <Area
                dataKey="bandwidth_gb"
                type="monotone"
                fill="transparent"
                stroke="var(--primary)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Browsers & Operating Systems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
        {/* Top Browsers */}
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader>
            <CardTitle className="text-white">Top Browsers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              <div ref={browsersChartRef}>
                <ChartContainer
                  config={chartConfig}
                  className="w-full"
                  style={{ height: `${browsersData.length * 45}px` }}>
                  <BarChart data={browsersData} layout="vertical" margin={{ left: 0, right: 80 }}>
                    <YAxis dataKey="label" type="category" hide />
                    <XAxis type="number" hide />
                    <Bar barSize={24} dataKey="visitors" fill="var(--secondary)" radius={4}>
                      <LabelList dataKey="label" position="insideLeft" className="fill-primary font-semibold" fontSize={14} />
                      <LabelList
                        dataKey="visitors"
                        content={({ y, height, value }) => {
                          const numericY = typeof y === 'string' ? parseFloat(y) : (typeof y === 'number' ? y : 0);
                          const numericHeight = typeof height === 'string' ? parseFloat(height) : (typeof height === 'number' ? height : 0);
                          const centerY = numericY + numericHeight / 2;
                          const rightEdgeX = (browsersChartWidth || 0) - 30;
                          return (
                            <text
                              x={rightEdgeX}
                              y={centerY}
                              dominantBaseline="middle"
                              textAnchor="end"
                              fill="white"
                              fontSize={14}
                              className="fill-zinc-400 font-bold"
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Top Operating Systems */}
        <Card className="bg-transparent border-zinc-800 w-full min-w-0">
          <CardHeader>
            <CardTitle className="text-white">Top Operating Systems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              <div ref={osChartRef} >
                <ChartContainer config={chartConfig}
                  className="w-full"
                  style={{ height: `${osData.length * 45}px` }}>
                  <BarChart data={osData} layout="vertical" margin={{ left: 0, right: 80 }} barCategoryGap={4}>
                    <YAxis dataKey="label" type="category" hide />
                    <XAxis type="number" hide />
                    <Bar barSize={32} dataKey="visitors" fill="var(--secondary)" radius={4}>
                      <LabelList dataKey="label" position="insideLeft" className="fill-primary font-semibold" fontSize={14} />
                      <LabelList
                        dataKey="visitors"
                        content={({ y, height, value }) => {
                          const numericY = typeof y === 'string' ? parseFloat(y) : (typeof y === 'number' ? y : 0);
                          const numericHeight = typeof height === 'string' ? parseFloat(height) : (typeof height === 'number' ? height : 0);
                          const centerY = numericY + numericHeight / 2;
                          const rightEdgeX = (osChartWidth || 0) - 30;
                          return (
                            <text
                              x={rightEdgeX}
                              y={centerY}
                              dominantBaseline="middle"
                              textAnchor="end"
                              fill="white"
                              fontSize={14}
                              className="fill-zinc-400 font-bold"
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const DashboardPage = dynamic(() => Promise.resolve(DashboardContent), { ssr: false })
export default DashboardPage