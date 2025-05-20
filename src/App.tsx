import { useState, useEffect, useRef } from 'react';
import _ from 'lodash';
import * as d3 from 'd3';

// Define interfaces for type safety
interface ConnectionScores {
  communication: number;
  reliability: number;
  emotional: number;
  shared: number;
  support: number;
}

interface ConnectionType {
  id: number;
  name: string;
  strength: number;
  lastContact: Date;
  halfLife: number;
  scores: ConnectionScores;
}

interface ActivityType {
  id: number;
  connectionId: number;
  type: string;
  points: number;
  date: Date;
  notes: string;
}

interface ConnectionLevel {
  level: number;
  label: string;
  badge: string;
}

interface NodeType extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  strength?: number;
  level?: number;
  original?: ConnectionType;
  halfLife?: number;
  lastContact?: number;
  fixed?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  source?: any;
  target?: any;
  index?: number;
}

interface LinkType extends d3.SimulationLinkDatum<NodeType> {
  source: string | NodeType;
  target: string | NodeType;
  strength: number;
}

// Network graph visualization component
const NetworkGraph = ({ 
  connections, 
  selectedConnectionId, 
  setSelectedConnection, 
  getCurrentStrength, 
  getConnectionLevel 
}: { 
  connections: ConnectionType[]; 
  selectedConnectionId: number | null; 
  setSelectedConnection: (connection: ConnectionType) => void; 
  getCurrentStrength: (connection: ConnectionType) => number; 
  getConnectionLevel: (strength: number) => ConnectionLevel;
}) => {
  // Function to calculate days since last contact
  const getDaysSinceContact = (lastContact: Date): number => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastContact.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();
    
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);
    
    // Create radial gradient defs for node glows
    const defs = svg.append("defs");
    
    // Create gradient for central node (you)
    const youGradient = defs.append("radialGradient")
      .attr("id", "you-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    
    youGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#00EEFF")
      .attr("stop-opacity", 0.8);
    
    youGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#006688")
      .attr("stop-opacity", 0.5);
      
    // Generate gradients for each connection strength level
    const levelColors = [
      { id: "dormant-gradient", inner: "#883333", outer: "#551111" },
      { id: "acquaintance-gradient", inner: "#6666FF", outer: "#333399" },
      { id: "friend-gradient", inner: "#33AAFF", outer: "#0077CC" },
      { id: "close-friend-gradient", inner: "#00DDFF", outer: "#00AADD" },
      { id: "inner-circle-gradient", inner: "#00FFFF", outer: "#00CCDD" }
    ];
    
    levelColors.forEach(color => {
      const gradient = defs.append("radialGradient")
        .attr("id", color.id)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color.inner)
        .attr("stop-opacity", 0.7);
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color.outer)
        .attr("stop-opacity", 0.5);
    });
    
    // Create filter for glow effect
    const glowFilter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    
    const glowMerge = glowFilter.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "coloredBlur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");
    
    // Prepare graph data
    const nodes: NodeType[] = [
      { id: 'center', name: 'YOU', fixed: true, x: width / 2, y: height / 2 },
      ...connections.map((conn: ConnectionType) => {
        const strength = getCurrentStrength(conn);
        return {
          id: conn.id.toString(),
          name: conn.name,
          strength: strength,
          level: getConnectionLevel(strength).level,
          original: conn,
          halfLife: conn.halfLife,
          lastContact: getDaysSinceContact(conn.lastContact),
          x: 0,
          y: 0,
          fx: null,
          fy: null
        };
      })
    ];
    
    const links = connections.map((conn: ConnectionType) => {
      const strength = getCurrentStrength(conn);
      return {
        source: 'center',
        target: conn.id.toString(),
        strength: strength
      };
    });
    
    // Create simulation
    const simulation = d3.forceSimulation<NodeType, LinkType>(nodes)
      .force("link", d3.forceLink<NodeType, LinkType>(links).id(d => d.id).distance(d => 200 - (d.strength || 0)))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));
    
    // Draw grid pattern background
    const gridSize = 30;
    const gridGroup = svg.append("g").attr("class", "grid")
      .attr("opacity", 0.15);
    
    // Horizontal and vertical grid lines
    for (let y = 0; y < height; y += gridSize) {
      gridGroup.append("line")
        .attr("x1", 0)
        .attr("y1", y)
        .attr("x2", width)
        .attr("y2", y)
        .attr("stroke", "#00AADD")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,6");
    }
    
    for (let x = 0; x < width; x += gridSize) {
      gridGroup.append("line")
        .attr("x1", x)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", height)
        .attr("stroke", "#00AADD")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,6");
    }
    
    // DS-style X marks
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 5 + 5;
      
      gridGroup.append("path")
        .attr("d", `M${x-size},${y-size} L${x+size},${y+size} M${x-size},${y+size} L${x+size},${y-size}`)
        .attr("stroke", "#00AADD")
        .attr("stroke-width", 0.5);
    }
    
    // Create links with varying thicknesses
    const link = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d: LinkType) => {
        const strength = d.strength;
        if (strength < 15) return "rgba(136, 51, 51, 0.6)"; // Dormant
        if (strength < 30) return "rgba(102, 102, 255, 0.6)"; // Acquaintance
        if (strength < 60) return "rgba(51, 170, 255, 0.6)"; // Friend
        if (strength < 100) return "rgba(0, 221, 255, 0.6)"; // Close Friend
        return "rgba(0, 255, 255, 0.6)"; // Inner Circle
      })
      .attr("stroke-width", (d: LinkType) => Math.max(1, d.strength / 20))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-dasharray", (d: LinkType) => d.strength < 15 ? "4,4" : "none")
      .attr("filter", "url(#glow)");
    
    // Add link labels for stronger connections
    const linkLabels = svg.append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(links.filter((d: LinkType) => d.strength >= 60))
      .enter()
      .append("text")
      .attr("font-size", 9)
      .attr("fill", "rgba(0, 238, 255, 0.7)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-family", "monospace")
      .text((d: LinkType) => Math.round(d.strength).toString());
    
    // Create the node container elements
    const nodeGroups = svg.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", d => d.id === 'center' ? 'node center-node' : 'node connection-node')
      .attr("cursor", "pointer")
      .attr("filter", d => {
        if (d.id === selectedConnectionId?.toString()) return "url(#glow)";
        return "none";
      })
      .on("click", (_event, d: NodeType) => {
        if (d.id !== 'center' && d.original) {
          setSelectedConnection(d.original);
        }
      })
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Function to create angular nodes (octagon path)
    const createOctagonPath = (radius: number): string => {
      const points = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        points.push([x, y]);
      }
      return d3.line<[number, number]>()(points as Array<[number, number]>) + "Z";
    };
    
    // Add octagonal nodes with Death Stranding style
    nodeGroups.each(function(d: NodeType) {
      const nodeGroup = d3.select(this);
      const radius = d.id === 'center' ? 30 : 20 + (d.level || 0) * 2;
      const isSelected = d.id === selectedConnectionId?.toString();
      
      // Determine gradient ID based on connection level
      let gradientId;
      if (d.id === 'center') {
        gradientId = 'you-gradient';
      } else {
        const level = d.level;
        if (level === 0) gradientId = 'dormant-gradient';
        else if (level === 1) gradientId = 'acquaintance-gradient';
        else if (level === 2) gradientId = 'friend-gradient';
        else if (level === 3) gradientId = 'close-friend-gradient';
        else gradientId = 'inner-circle-gradient';
      }
      
      // Draw octagon shape for node
      nodeGroup.append("path")
        .attr("d", createOctagonPath(radius))
        .attr("fill", `url(#${gradientId})`)
        .attr("stroke", isSelected ? "#00EEFF" : "#00AADD")
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("stroke-opacity", isSelected ? 0.9 : 0.7);
      
      // Add inner octagon for DS style (smaller)
      nodeGroup.append("path")
        .attr("d", createOctagonPath(radius * 0.7))
        .attr("fill", "none")
        .attr("stroke", "#FFFFFF")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.3);
      
      // Add corner markers (Death Stranding style)
      // Top, right, bottom, left points
      const cornerPoints = [
        [0, -radius], [radius, 0], [0, radius], [-radius, 0]
      ];
      
      cornerPoints.forEach(([x, y]) => {
        nodeGroup.append("line")
          .attr("x1", x)
          .attr("y1", y)
          .attr("x2", x * 1.2)
          .attr("y2", y * 1.2)
          .attr("stroke", "#00EEFF")
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.5);
      });
      
      // Add node label
      nodeGroup.append("text")
        .attr("dy", d.id === 'center' ? radius + 15 : radius + 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#88CCFF")
        .attr("font-size", d.id === 'center' ? 12 : 10)
        .attr("font-family", "monospace")
        .attr("letter-spacing", "0.1em")
        .attr("fill-opacity", 0.9)
        .text(d.name);
      
      // Add strength label for connections
      if (d.id !== 'center') {
        nodeGroup.append("text")
          .attr("dy", -radius - 8)
          .attr("text-anchor", "middle")
          .attr("fill", "#FFFFFF")
          .attr("font-size", 10)
          .attr("font-family", "monospace")
          .attr("letter-spacing", "0.05em")
          .attr("font-weight", "300")
          .attr("fill-opacity", 0.9)
          .text(Math.round(d.strength).toString().padStart(2, '0'));
      }
    });
    
    // Update positions on each tick
    simulation.on("tick", () => {
      // Fix center node position
      if (nodes[0]) {
        nodes[0].x = width / 2;
        nodes[0].y = height / 2;
      }
      
      link
        .attr("x1", (d: any) => d.source.x || 0)
        .attr("y1", (d: any) => d.source.y || 0)
        .attr("x2", (d: any) => d.target.x || 0)
        .attr("y2", (d: any) => d.target.y || 0);
      
      linkLabels
        .attr("x", (d: any) => ((d.source.x || 0) + (d.target.x || 0)) / 2)
        .attr("y", (d: any) => ((d.source.y || 0) + (d.target.y || 0)) / 2);
      
      nodeGroups
        .attr("transform", (d: any) => `translate(${d.x || 0},${d.y || 0})`);
    });
    
    // Drag functions
    function dragstarted(event: any, d: NodeType) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x || 0;
      d.fy = d.y || 0;
    }
    
    function dragged(event: any, d: NodeType) {
      if (d.id !== 'center') { // Prevent dragging the center node
        d.fx = event.x || 0;
        d.fy = event.y || 0;
      }
    }
    
    function dragended(event: any, d: NodeType) {
      if (!event.active) simulation.alphaTarget(0);
      if (d.id !== 'center') {
        d.fx = null;
        d.fy = null;
      }
    }
    
    // Keep center node fixed
    nodes[0].fx = width / 2;
    nodes[0].fy = height / 2;
    
    // Clean up on unmount
    return () => {
      simulation.stop();
    };
  }, [connections, selectedConnectionId, setSelectedConnection, getCurrentStrength, getConnectionLevel]);
  
  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

// Define animations for holographic effects
const holographicAnimations = `
  @keyframes pulse {
    0% { opacity: 0.8; filter: brightness(1.1); }
    50% { opacity: 0.4; filter: brightness(0.9); }
    100% { opacity: 0.8; filter: brightness(1.1); }
  }
  
  @keyframes float-around {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(10px, 15px) rotate(1deg); }
    50% { transform: translate(-5px, 20px) rotate(-1deg); }
    75% { transform: translate(-15px, 5px) rotate(0.5deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
  }
  
  @keyframes scan-line {
    0% { transform: translateY(0); opacity: 0.05; }
    50% { opacity: 0.1; }
    100% { transform: translateY(100vh); opacity: 0.05; }
  }
  
  @keyframes data-pulse {
    0% { opacity: 0.1; filter: hue-rotate(0deg); }
    50% { opacity: 0.4; filter: hue-rotate(10deg); }
    100% { opacity: 0.1; filter: hue-rotate(0deg); }
  }
  
  @keyframes glow {
    0% { filter: drop-shadow(0 0 2px rgba(6, 182, 212, 0.3)); }
    50% { filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.6)); }
    100% { filter: drop-shadow(0 0 2px rgba(6, 182, 212, 0.3)); }
  }
  
  @keyframes flicker {
    0%, 100% { opacity: 1; }
    5% { opacity: 0.9; }
    10% { opacity: 1; }
    15% { opacity: 0.9; }
    70% { opacity: 1; }
    75% { opacity: 0.8; }
    80% { opacity: 1; }
  }

  @keyframes rain {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  
  .animate-pulse {
    animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .animate-pulse-slow {
    animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .animate-pulse-slower {
    animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .animate-pulse-fast {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .animate-float {
    animation: float-around 20s ease-in-out infinite;
  }
  
  .animate-scan-line {
    animation: scan-line 8s linear infinite;
  }
  
  .animate-data-pulse {
    animation: data-pulse 3s ease-in-out infinite;
  }
  
  .animate-glow {
    animation: glow 4s ease-in-out infinite;
  }
  
  .animate-flicker {
    animation: flicker 4s linear infinite;
  }
`;

// Timefall Forecast component
const TimefallForecast = ({ 
  connections, 
  getCurrentStrength, 
  getProjectedStrength, 
  getDaysUntilThreshold, 
  getConnectionLevel 
}: { 
  connections: ConnectionType[];
  getCurrentStrength: (connection: ConnectionType) => number;
  getProjectedStrength: (connection: ConnectionType, daysInFuture: number) => number;
  getDaysUntilThreshold: (connection: ConnectionType, threshold: number) => number;
  getConnectionLevel: (strength: number) => ConnectionLevel;
}) => {
  const forecastDays = [7, 14, 30, 60, 90]; // Forecast time periods
  const thresholds = [
    { value: 15, label: 'Dormant', color: '#FF5555' },
    { value: 30, label: 'Acquaintance', color: '#AAAAFF' },
    { value: 60, label: 'Friend', color: '#55AAFF' }
  ];
  
  // Sort connections by days until dormancy
  const sortedConnections = [...connections].sort((a, b) => {
    const aDays = getDaysUntilThreshold(a, 15);
    const bDays = getDaysUntilThreshold(b, 15);
    return aDays - bDays;
  });
  
  return (
    <div className="relative">
      <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
      <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
      <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
      <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
      
      <div className="flex items-center mb-6 bg-gradient-to-r from-cyan-900/10 to-transparent px-4 py-2">
        <div className="text-xl font-light tracking-wider mr-3">TIMEFALL FORECAST</div>
        <div className="text-xs opacity-70">
          Connection strength decay prediction system
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-4 mb-6">
        {thresholds.map(threshold => (
          <div key={threshold.value} className="col-span-5 sm:col-span-1 p-3 bg-gradient-to-b from-cyan-900/10 to-transparent relative">
            <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-400"></div>
            <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
            <div className="absolute bottom-0 left-0 w-1 h-1 bg-cyan-400"></div>
            <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
            
            <div className="text-xs tracking-wider opacity-70 mb-1">THRESHOLD</div>
            <div className="flex items-baseline">
              <div className="text-xl font-light tracking-tighter mr-2">{threshold.value.toString().padStart(2, '0')}</div>
              <div className="text-sm opacity-80">{threshold.label}</div>
            </div>
            <div 
              className="h-1 w-full mt-2" 
              style={{ backgroundColor: threshold.color, opacity: 0.5 }}
            ></div>
          </div>
        ))}
      </div>
      
      <div className="space-y-8">
        {sortedConnections.map(connection => {
          const currentStrength = getCurrentStrength(connection);
          const daysUntilDormant = getDaysUntilThreshold(connection, 15);
          const isAtRisk = daysUntilDormant <= 14 && currentStrength > 15;
          const willExpireSoon = daysUntilDormant <= 7 && currentStrength > 15;
          
          return (
            <div 
              key={connection.id} 
              className={`p-4 relative ${willExpireSoon ? 'bg-red-900/10 border border-red-800/30' : isAtRisk ? 'bg-amber-900/10 border border-amber-800/30' : 'bg-cyan-900/10'}`}
            >
              <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
              <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
              <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
              <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
              <div className="absolute bottom-0 left-0 w-2 h-px bg-cyan-400"></div>
              <div className="absolute bottom-0 left-0 w-px h-2 bg-cyan-400"></div>
              <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
              <div className="absolute bottom-0 right-0 w-px h-2 bg-cyan-400"></div>
              
              <div className="flex justify-between items-baseline mb-4">
                <div className="text-lg font-light tracking-wider">{connection.name}</div>
                
                <div className="flex items-center">
                  <div className="text-xs opacity-70 mr-2">CURRENT</div>
                  <div className="text-xl font-light tracking-tighter">
                    {Math.round(currentStrength).toString().padStart(2, '0')}
                  </div>
                </div>
              </div>
              
              {/* Status indicators */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="col-span-1 p-2 bg-black/20 relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="text-xs opacity-70">HALF-LIFE</div>
                  <div className="text-lg font-light tracking-tighter">{connection.halfLife}d</div>
                </div>
                
                <div className="col-span-1 p-2 bg-black/20 relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="text-xs opacity-70">LAST CONTACT</div>
                  <div className="text-lg font-light tracking-tighter">{connection.lastContact.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                
                <div className="col-span-2 p-2 bg-black/20 relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="text-xs opacity-70">TIME TO DORMANCY</div>
                  <div className={`text-lg font-light ${willExpireSoon ? 'text-red-400' : isAtRisk ? 'text-amber-400' : ''}`}>
                    {daysUntilDormant > 0 
                      ? `${daysUntilDormant} days remaining` 
                      : 'Dormant now'}
                  </div>
                </div>
              </div>
              
              {/* Forecast timeline */}
              <div className="mb-2 flex items-center">
                <div className="text-xs tracking-wider opacity-70 mr-2">TIMEFALL DECAY FORECAST</div>
                <div className="flex-1 h-px bg-cyan-900/30"></div>
              </div>
              
              <div className="relative pt-6 pb-2">
                {/* Time markers */}
                <div className="absolute top-0 left-0 right-0 flex justify-between text-xs opacity-70">
                  <div>Now</div>
                  {forecastDays.map(days => (
                    <div key={days} className="text-center">
                      +{days}d
                    </div>
                  ))}
                </div>
                
                {/* Connection strength timeline */}
                <div className="relative h-10 bg-gradient-to-r from-cyan-900/5 to-transparent">
                  {/* Threshold markers */}
                  {thresholds.map(threshold => (
                    <div 
                      key={threshold.value}
                      className="absolute left-0 right-0 border-t border-dashed z-10"
                      style={{ 
                        top: `${100 - Math.min(100, threshold.value)}%`, 
                        borderColor: threshold.color,
                        opacity: 0.7
                      }}
                    >
                      <div 
                        className="absolute -top-1 -right-6 text-xs"
                        style={{ color: threshold.color }}
                      >
                        {threshold.value}
                      </div>
                    </div>
                  ))}
                  
                  {/* Current and projected strengths */}
                  <div className="absolute top-0 left-0 right-0 h-full flex items-end">
                    <div 
                      className="h-full flex items-end"
                      style={{ width: '16%' }}
                    >
                      <div 
                        className="w-2 bg-cyan-400"
                        style={{ 
                          height: `${Math.min(100, currentStrength)}%`,
                        }}
                      ></div>
                    </div>
                    
                    {forecastDays.map((days, index) => {
                      const projectedStrength = getProjectedStrength(connection, days);
                      const nextLevel = getConnectionLevel(projectedStrength);
                      let barColor = '#00CCEE';
                      
                      if (projectedStrength < 15) barColor = '#FF5555';
                      else if (projectedStrength < 30) barColor = '#AAAAFF';
                      else if (projectedStrength < 60) barColor = '#55AAFF';
                      
                      return (
                        <div 
                          key={days}
                          className="h-full flex items-end justify-center"
                          style={{ width: '16%' }}
                        >
                          <div className="flex flex-col items-center">
                            <div 
                              className="w-2 relative" 
                              style={{ 
                                height: `${Math.min(100, projectedStrength)}%`,
                                backgroundColor: barColor,
                                opacity: 0.8
                              }}
                            >
                              {/* Animated rain effect (Timefall) */}
                              {projectedStrength < currentStrength && (
                                <div className="absolute -top-3 left-0 w-full overflow-hidden opacity-60">
                                  <div className="animate-[rain_2s_linear_infinite] text-[0.5rem] leading-none text-blue-300 tracking-wider">
                                    |<br/>|<br/>|<br/>|<br/>|<br/>|
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-2 text-xs font-light">
                              {Math.round(projectedStrength).toString().padStart(2, '0')}
                            </div>
                            <div className="text-[0.6rem] opacity-70">
                              {nextLevel.badge}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Recommendation */}
                {willExpireSoon && (
                  <div className="mt-4 p-2 bg-red-900/20 text-xs border-l-2 border-red-500 pl-2">
                    <div className="text-red-400 font-light animate-pulse-fast">CRITICAL TIMEFALL WARNING</div>
                    <div className="opacity-80 mt-1">Connection will become dormant within 7 days. Immediate interaction recommended.</div>
                  </div>
                )}
                {isAtRisk && !willExpireSoon && (
                  <div className="mt-4 p-2 bg-amber-900/20 text-xs border-l-2 border-amber-500 pl-2">
                    <div className="text-amber-400 font-light animate-pulse-slow">TIMEFALL ADVISORY</div>
                    <div className="opacity-80 mt-1">Connection at risk of dormancy within 14 days. Schedule interaction soon.</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-8 flex justify-center">
        <div className="p-3 bg-black/30 text-xs max-w-lg text-center relative">
          <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
          <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
          <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
          <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
          <div className="absolute bottom-0 left-0 w-2 h-px bg-cyan-400"></div>
          <div className="absolute bottom-0 left-0 w-px h-2 bg-cyan-400"></div>
          <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
          <div className="absolute bottom-0 right-0 w-px h-2 bg-cyan-400"></div>
          
          <div className="font-light tracking-wider mb-2">ABOUT TIMEFALL FORECAST</div>
          <div className="opacity-70 text-[0.65rem] leading-relaxed">
            The Timefall Forecast system visualizes the exponential decay of connection strength over time. 
            Like the timefall rain in Death Stranding that accelerates time's effect on objects, 
            this feature shows how relationships weaken when left unattended. 
            Interact regularly to maintain connection levels above critical thresholds.
          </div>
        </div>
      </div>
    </div>
  );
};

// Main application component
const StrandSystem = () => {
  // State management
  const [connections, setConnections] = useState<ConnectionType[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionType | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [statsView, setStatsView] = useState('network'); // 'network', 'star-chart', 'interaction-log', 'timefall-forecast'
  const [showAddConnectionModal, setShowAddConnectionModal] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    strength: 30,
    halfLife: 21,
    scores: {
      communication: 30,
      reliability: 30,
      emotional: 30,
      shared: 30,
      support: 30
    }
  });
  
  // Sample data for initial display
  useEffect(() => {
    const sampleConnections = [
      { id: 1, name: 'Sam', strength: 75, lastContact: new Date(2025, 4, 15), halfLife: 21, 
        scores: { communication: 80, reliability: 70, emotional: 85, shared: 65, support: 75 } },
      { id: 2, name: 'Fragile', strength: 45, lastContact: new Date(2025, 4, 10), halfLife: 14, 
        scores: { communication: 50, reliability: 40, emotional: 55, shared: 35, support: 45 } },
      { id: 3, name: 'Deadman', strength: 28, lastContact: new Date(2025, 4, 5), halfLife: 30, 
        scores: { communication: 30, reliability: 25, emotional: 35, shared: 20, support: 30 } },
      { id: 4, name: 'Heartman', strength: 95, lastContact: new Date(2025, 4, 16), halfLife: 14, 
        scores: { communication: 90, reliability: 100, emotional: 95, shared: 85, support: 105 } },
      { id: 5, name: 'Mama', strength: 15, lastContact: new Date(2025, 3, 20), halfLife: 21, 
        scores: { communication: 15, reliability: 20, emotional: 10, shared: 15, support: 15 } },
    ];
    
    const sampleActivities = [
      { id: 1, connectionId: 1, type: 'call', points: 8, date: new Date(2025, 4, 15), notes: 'Discussed upcoming projects' },
      { id: 2, connectionId: 4, type: 'in-person', points: 15, date: new Date(2025, 4, 16), notes: 'Coffee meetup' },
      { id: 3, connectionId: 2, type: 'text', points: 3, date: new Date(2025, 4, 10), notes: 'Quick check-in' },
      { id: 4, connectionId: 3, type: 'react', points: 1, date: new Date(2025, 4, 5), notes: 'Liked photo' },
      { id: 5, connectionId: 5, type: 'text', points: 3, date: new Date(2025, 3, 20), notes: 'Birthday wishes' },
    ];
    
    setConnections(sampleConnections);
    setActivities(sampleActivities);
  }, []);

  // Calculate connection level based on strength
  const getConnectionLevel = (strength: number): ConnectionLevel => {
    if (strength < 15) return { level: 0, label: 'Dormant', badge: '✖️' };
    if (strength < 30) return { level: 1, label: 'Acquaintance', badge: '★' };
    if (strength < 60) return { level: 2, label: 'Friend', badge: '★★' };
    if (strength < 100) return { level: 3, label: 'Close Friend', badge: '★★★' };
    return { level: 4, label: 'Inner Circle', badge: '★★★★★' };
  };

  // Calculate days since last contact
  const getDaysSinceContact = (lastContact: Date): number => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastContact.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate current strength after decay
  const getCurrentStrength = (connection: ConnectionType): number => {
    const daysPassed = getDaysSinceContact(connection.lastContact);
    return connection.strength * Math.pow(0.5, daysPassed / connection.halfLife);
  };

  // Calculate projected strength for a future date
  const getProjectedStrength = (connection: ConnectionType, daysInFuture: number): number => {
    const currentStrength = getCurrentStrength(connection);
    return currentStrength * Math.pow(0.5, daysInFuture / connection.halfLife);
  };

  // Predict days until connection falls below threshold
  const getDaysUntilThreshold = (connection: ConnectionType, threshold: number): number => {
    const currentStrength = getCurrentStrength(connection);
    if (currentStrength <= threshold) return 0;
    
    // S(t+Δ) = S(t) * 0.5^(Δ/τ)
    // Solve for Δ: Δ = τ * log_0.5(S(t+Δ)/S(t))
    // For S(t+Δ) = threshold, Δ = τ * log_0.5(threshold/S(t))
    
    const logBase = (x: number, base: number): number => Math.log(x) / Math.log(base);
    const daysUntil = connection.halfLife * logBase(threshold / currentStrength, 0.5);
    
    return Math.ceil(daysUntil);
  };

  // Add new interaction
  const addInteraction = (connectionId: number, type: string, notes = ''): void => {
    const pointsMap: Record<string, number> = {
      'react': 1,
      'text': 3,
      'call': 8,
      'game': 10,
      'in-person': 15,
      'day-trip': 25
    };
    
    const points = pointsMap[type] || 0;
    const newActivity = {
      id: activities.length + 1,
      connectionId,
      type,
      points,
      date: new Date(),
      notes
    };
    
    setActivities([newActivity, ...activities]);
    
    // Update connection strength
    setConnections(connections.map(conn => {
      if (conn.id === connectionId) {
        const newStrength = Math.min(conn.strength + points, 120); // Cap at 120 for visual purposes
        return {
          ...conn,
          strength: newStrength,
          lastContact: new Date()
        };
      }
      return conn;
    }));
  };

  // Filter connections that need attention (below threshold)
  const getNeedAttentionConnections = () => {
    return connections.filter(conn => {
      const currentStrength = getCurrentStrength(conn);
      return currentStrength < 15;
    });
  };
  
  // Handle adding a new connection
  const handleAddConnection = () => {
    const newId = Math.max(0, ...connections.map(c => c.id)) + 1;
    const connectionToAdd = {
      ...newConnection,
      id: newId,
      lastContact: new Date()
    };
    
    setConnections([...connections, connectionToAdd]);
    setShowAddConnectionModal(false);
    setNewConnection({
      name: '',
      strength: 30,
      halfLife: 21,
      scores: {
        communication: 30,
        reliability: 30,
        emotional: 30,
        shared: 30,
        support: 30
      }
    });
  };
  
  // Update new connection form field
  const updateNewConnectionField = (field: string, value: any): void => {
    setNewConnection(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Update new connection score field
  const updateNewConnectionScore = (field: string, value: any): void => {
    setNewConnection(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        [field]: parseInt(value) || 0
      }
    }));
  };

  // CSS utility for Death Stranding border effect
  const borderStyle = "relative before:content-[''] before:absolute before:left-0 before:top-0 before:right-0 before:h-px before:bg-cyan-400 before:opacity-40 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-cyan-400 after:opacity-40";
  
  // CSS utility for dotted separation line
  const dottedSeparator = "border-dashed border-cyan-700/30 border-t my-4";
  
  // Marker elements for the DS UI style
  const Marker = ({position = "top-left"}: {position: "top-left" | "top-right" | "bottom-left" | "bottom-right"}) => {
    const positionClasses: Record<"top-left" | "top-right" | "bottom-left" | "bottom-right", string> = {
      "top-left": "top-0 left-0",
      "top-right": "top-0 right-0",
      "bottom-left": "bottom-0 left-0",
      "bottom-right": "bottom-0 right-0",
    };
    
    return (
      <div className={`absolute w-3 h-3 ${positionClasses[position]}`}>
        <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
        <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen text-cyan-400 font-mono relative overflow-hidden">
      {/* Add holographic animations */}
      <style dangerouslySetInnerHTML={{ __html: holographicAnimations }} />
      
      {/* Main background blur and gradients with enhanced atmospheric depth */}
      <div className="fixed inset-0 bg-black -z-10"></div>
      
      {/* Primary central radial gradient - increased opacity */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,200,255,0.25)_0%,_rgba(0,130,255,0.15)_30%,_transparent_70%)] blur-xl -z-10"></div>
      
      {/* Vertical gradient overlay for depth - increased opacity */}
      <div className="fixed inset-0 bg-gradient-to-b from-cyan-900/20 via-blue-900/10 to-black/20 -z-10"></div>
      
      {/* Asymmetrical corner gradients - increased opacity */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,180,230,0.15)_0%,_transparent_50%)] -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(0,120,255,0.15)_0%,_transparent_50%)] -z-10"></div>
      
      {/* Additional atmospheric depth gradient */}
      <div className="fixed inset-0 bg-[conic-gradient(at_top_right,_rgba(0,200,255,0.08),_rgba(0,0,40,0.0))] -z-10"></div>
      <div className="fixed inset-0 bg-[conic-gradient(at_bottom_left,_rgba(0,100,255,0.08),_rgba(0,0,40,0.0))] -z-10"></div>
      
      {/* Holographic glow effects - enhanced brightness */}
      <div className="fixed inset-0 -z-10">
        {/* Primary glow */}
        <div className="absolute top-[40%] left-[48%] w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-cyan-500/15 via-cyan-400/10 to-transparent blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse-slower"></div>
        
        {/* Secondary glows */}
        <div className="absolute top-[15%] left-[20%] w-[30rem] h-[30rem] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-500/10 blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[25%] right-[15%] w-[35rem] h-[25rem] rounded-full bg-gradient-to-l from-blue-400/12 to-cyan-500/15 blur-3xl animate-pulse"></div>
        
        {/* Accent glows */}
        <div className="absolute top-[30%] right-[25%] w-64 h-64 rounded-full bg-gradient-to-tr from-indigo-500/10 via-cyan-400/8 to-transparent blur-2xl animate-float"></div>
        <div className="absolute bottom-[40%] left-[30%] w-80 h-40 rounded-full bg-gradient-to-br from-blue-500/12 to-cyan-400/8 blur-2xl rotate-12 animate-pulse-fast"></div>
        <div className="absolute top-[60%] right-[40%] w-48 h-48 rounded-full bg-gradient-to-tr from-cyan-300/10 to-transparent blur-xl animate-pulse-slow"></div>
      </div>
      
      {/* Scan line effect with enhanced opacity */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="w-full h-full bg-[linear-gradient(transparent_0%,_transparent_49%,_rgba(0,175,255,0.09)_50%,_transparent_51%,_transparent_100%)] bg-[length:100%_4px]"></div>
      </div>
      
      {/* Subtle vignette effect */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(0,0,20,0.4)_100%)] pointer-events-none -z-10"></div>
      
      {/* Enhanced holographic UI markers */}
      {/* Corner dots */}
      <div className="absolute top-4 left-4 w-1 h-1 bg-cyan-400 opacity-60 animate-pulse-slow"></div>
      <div className="absolute top-4 right-4 w-1 h-1 bg-cyan-400 opacity-60 animate-pulse-slow"></div>
      <div className="absolute bottom-4 left-4 w-1 h-1 bg-cyan-400 opacity-60 animate-pulse-slow"></div>
      <div className="absolute bottom-4 right-4 w-1 h-1 bg-cyan-400 opacity-60 animate-pulse-slow"></div>
      
      {/* Corner lines */}
      <div className="absolute top-8 left-8 w-px h-6 bg-cyan-400 opacity-30"></div>
      <div className="absolute top-8 right-8 w-px h-6 bg-cyan-400 opacity-30"></div>
      <div className="absolute bottom-8 left-8 w-px h-6 bg-cyan-400 opacity-30"></div>
      <div className="absolute bottom-8 right-8 w-px h-6 bg-cyan-400 opacity-30"></div>
      
      {/* Additional UI elements */}
      <div className="absolute top-20 left-12 w-4 h-px bg-gradient-to-r from-cyan-400/80 to-transparent animate-pulse-fast"></div>
      <div className="absolute top-20 right-12 w-4 h-px bg-gradient-to-l from-cyan-400/80 to-transparent animate-pulse-fast"></div>
      <div className="absolute bottom-20 left-12 w-4 h-px bg-gradient-to-r from-cyan-400/80 to-transparent animate-pulse-fast"></div>
      <div className="absolute bottom-20 right-12 w-4 h-px bg-gradient-to-l from-cyan-400/80 to-transparent animate-pulse-fast"></div>
      
      {/* X markers (Death Stranding style) */}
      <div className="absolute top-[10%] left-[5%] text-cyan-500/10 text-xl rotate-12 animate-pulse-slower">×</div>
      <div className="absolute top-[8%] right-[7%] text-cyan-500/10 text-xl -rotate-12 animate-pulse-slower">×</div>
      <div className="absolute bottom-[7%] left-[8%] text-cyan-500/10 text-xl -rotate-6 animate-pulse-slow">×</div>
      <div className="absolute bottom-[9%] right-[6%] text-cyan-500/10 text-xl rotate-6 animate-pulse-slow">×</div>
      
      {/* Digital coordinates */}
      <div className="absolute top-16 left-16 text-[8px] text-cyan-500/20 animate-pulse-slow font-mono">X:32.45 Y:08.72</div>
      <div className="absolute top-16 right-16 text-[8px] text-cyan-500/20 animate-pulse-slow font-mono text-right">SEC:A4 REF:1052</div>
      <div className="absolute bottom-16 left-16 text-[8px] text-cyan-500/20 animate-pulse-slow font-mono">CHRL:45%</div>
      <div className="absolute bottom-16 right-16 text-[8px] text-cyan-500/20 animate-pulse-slow font-mono text-right">SYS:ACTIVE</div>
      
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,170,221,0.03)_0%,_transparent_60%)] pointer-events-none"></div>
      
      {/* Enhanced grid pattern with multiple layers */}
      <div className="fixed inset-0 opacity-5 pointer-events-none -z-10">
        {/* Main grid */}
        <div className="w-full h-full border border-cyan-500/30 border-dashed" 
          style={{ 
            backgroundSize: '40px 40px', 
            backgroundImage: 'linear-gradient(to right, rgba(0,200,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,200,255,0.1) 1px, transparent 1px)' 
          }}
        ></div>
      </div>
      
      {/* Secondary fine grid */}
      <div className="fixed inset-0 opacity-3 pointer-events-none -z-10">
        <div className="w-full h-full" 
          style={{ 
            backgroundSize: '8px 8px', 
            backgroundImage: 'linear-gradient(to right, rgba(0,170,230,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,170,230,0.03) 1px, transparent 1px)' 
          }}
        ></div>
      </div>
      
      {/* Grid accent lines */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent"></div>
        <div className="absolute left-2/4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent"></div>
        <div className="absolute left-3/4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent"></div>
        
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent"></div>
        <div className="absolute top-2/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent"></div>
        <div className="absolute top-3/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent"></div>
      </div>
      
      {/* Header - added glow and enhanced blur */}
      <header className={`p-4 ${borderStyle} flex justify-between items-center backdrop-blur-md bg-black/40 shadow-[0_0_15px_rgba(0,180,230,0.15)] relative overflow-hidden`}>
        {/* Subtle header glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 via-transparent to-cyan-900/10 pointer-events-none"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="flex items-center">
          <div className="text-2xl tracking-widest mr-4 font-light relative overflow-hidden">
            <span className="font-mono tracking-[0.2em] text-cyan-300 text-shadow-glow">STRAND</span>
            <span className="font-mono tracking-[0.15em] text-cyan-400 ml-1.5 text-shadow-glow">FRIENDS</span>
            {/* Angular design elements */}
            <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
            <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
            <div className="animate-pulse-slow absolute -z-10 inset-0 bg-gradient-to-r from-transparent via-cyan-950/20 to-transparent"></div>
          </div>
          <div className="text-sm text-cyan-300 tracking-wider opacity-80">CONNECTION MANAGEMENT SYSTEM</div>
        </div>
        <div className="flex items-center">
          <div className="relative px-4 py-2 mr-4 bg-gradient-to-b from-cyan-900/30 to-transparent">
            <Marker position="top-left" />
            <Marker position="top-right" />
            <Marker position="bottom-left" />
            <Marker position="bottom-right" />
            <div className="text-xs tracking-wider opacity-70">PORTER GRADE</div>
            <div className="flex items-baseline">
              <span className="text-3xl font-light mr-1">0</span>
              <span className="text-4xl font-light tracking-tighter text-cyan-300">2</span>
              <span className="text-3xl font-light ml-1">1</span>
            </div>
          </div>
          <div className="relative px-4 py-2 bg-gradient-to-b from-cyan-900/20 to-transparent">
            <Marker position="top-left" />
            <Marker position="bottom-left" />
            <div className="text-xs tracking-wider opacity-70">HALF-LIFE</div>
            <div className="flex items-baseline">
              <span className="text-3xl font-light mr-1">2</span>
              <span className="text-3xl font-light text-cyan-300">1</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - added glow and enhanced blur */}
        <div className={`w-64 ${borderStyle} overflow-y-auto p-4 relative backdrop-blur-md bg-black/30 shadow-[0_0_15px_rgba(0,180,230,0.1)] border-r border-cyan-900/20`}>
          {/* Subtle sidebar glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
          <Marker position="top-right" />
          <Marker position="bottom-right" />
          
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs tracking-wider opacity-70">
              <span className="mr-2">- - -</span>
              CONNECTIONS
              <span className="ml-2">- - -</span>
            </div>
            <button 
              onClick={() => setShowAddConnectionModal(true)}
              className="text-xs text-cyan-300 hover:text-cyan-100 hover:shadow-[0_0_8px_rgba(0,200,255,0.3)] flex items-center transition-all duration-300"
            >
              <span className="mr-1 text-lg leading-none">+</span>
              <span className="tracking-wider">ADD</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {connections.map(connection => {
              const currentStrength = getCurrentStrength(connection);
              const level = getConnectionLevel(currentStrength);
              return (
                <div 
                  key={connection.id}
                  className={`relative p-2 cursor-pointer group transition-all duration-300 ${selectedConnection?.id === connection.id ? 'bg-cyan-900/40 shadow-[0_0_8px_rgba(0,200,255,0.1)]' : 'hover:bg-cyan-900/20 hover:shadow-[0_0_5px_rgba(0,180,230,0.05)]'}`}
                  onClick={() => setSelectedConnection(connection)}
                >
                  <Marker position="top-left" />
                  <Marker position="bottom-left" />
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  
                  {/* Border lines - Death Stranding style */}
                  <div className="absolute top-0 left-2 right-2 h-px border-t border-dashed border-cyan-400/20"></div>
                  <div className="absolute bottom-0 left-2 right-2 h-px border-b border-dashed border-cyan-400/20"></div>
                  <div className="absolute left-0 top-2 bottom-2 w-px border-l border-dashed border-cyan-400/20"></div>
                  <div className="absolute right-0 top-2 bottom-2 w-px border-r border-dashed border-cyan-400/20"></div>
                  
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors duration-300"></div>
                  
                  <div className="flex justify-between">
                    <div className="font-light">{connection.name}</div>
                    <div className="text-lg">{level.badge}</div>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <div className="opacity-70">{level.label}</div>
                    <div className="text-right">
                      <span className="text-xl font-light tracking-tighter">{Math.round(currentStrength).toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-cyan-900/20 h-1 rounded-none overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500/70 to-cyan-400" 
                      style={{ width: `${Math.min(100, (currentStrength/100) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs mt-1 opacity-70 flex justify-between">
                    <span>LAST CONTACT</span>
                    <span className="font-light">{getDaysSinceContact(connection.lastContact)}d</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className={dottedSeparator}></div>
          
          <div className="mt-4">
            <div className="text-xs mb-3 tracking-wider text-amber-400 opacity-80">
              <span className="mr-2">- - -</span>
              NEED ATTENTION
              <span className="ml-2">- - -</span>
            </div>
            <div className="space-y-2">
              {getNeedAttentionConnections().map(connection => (
                <div key={`alert-${connection.id}`} className="text-xs border border-amber-800/50 bg-amber-900/10 p-2 relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-amber-400"></div>
                  <div className="absolute top-0 right-0 w-1 h-1 bg-amber-400"></div>
                  <div className="absolute bottom-0 left-0 w-1 h-1 bg-amber-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-amber-400"></div>
                  
                  {/* Border lines - Death Stranding style */}
                  <div className="absolute top-0 left-2 right-2 h-px border-t border-dashed border-amber-400/20"></div>
                  <div className="absolute bottom-0 left-2 right-2 h-px border-b border-dashed border-amber-400/20"></div>
                  <div className="absolute left-0 top-2 bottom-2 w-px border-l border-dashed border-amber-400/20"></div>
                  <div className="absolute right-0 top-2 bottom-2 w-px border-r border-dashed border-amber-400/20"></div>
                  
                  <div className="font-light text-amber-400">{connection.name}</div>
                  <div className="opacity-70 mt-1 flex justify-between">
                    <span>NO CONTACT</span>
                    <span className="font-light">{getDaysSinceContact(connection.lastContact)}d</span>
                  </div>
                </div>
              ))}
              
              {getNeedAttentionConnections().length === 0 && (
                <div className="text-xs opacity-50 text-center p-2">
                  No dormant connections
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Main panel - added glow and depth */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-black/60 to-black/80 relative shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,200,255,0.03)_0%,_transparent_60%)] pointer-events-none"></div>
          {/* View selector - added glow */}
          <div className="flex border-b border-cyan-900/50 relative backdrop-blur-md bg-black/40 shadow-[0_2px_5px_rgba(0,0,0,0.2)] overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
            <Marker position="top-left" />
            <Marker position="top-right" />
            {['NETWORK', 'STAR CHART', 'INTERACTION LOG', 'TIMEFALL FORECAST'].map((view, index) => {
              const viewValue = view.toLowerCase().replace(/\s+/g, '-');
              return (
                <button
                  key={viewValue}
                  className={`px-4 py-2 text-sm tracking-wider relative transition-all duration-300 ${statsView === viewValue ? 'bg-cyan-900/30 text-cyan-300 shadow-[0_0_10px_rgba(0,200,255,0.1)]' : 'opacity-70 hover:bg-cyan-900/20 hover:text-cyan-300/90 hover:shadow-[0_0_8px_rgba(0,180,230,0.1)]'}`}
                  onClick={() => setStatsView(viewValue)}
                >
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute bottom-0 left-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-900"></div>
                  <div className="flex items-baseline">
                    <span className="text-lg font-light mr-1 text-cyan-400">0{index+1}</span>
                    <span>{view}</span>
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Main visualization area - added glow and enhanced blur */}
          <div className="flex-1 overflow-auto p-4">
            <div className="bg-black/30 border border-cyan-900/40 backdrop-blur-md rounded-sm p-4 relative h-full shadow-[0_0_20px_rgba(0,0,0,0.3),inset_0_0_30px_rgba(0,0,0,0.3)] transition-all duration-500" style={{ minHeight: '600px' }}>
              {/* Content glow effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(0,200,255,0.03)_0%,_transparent_70%)] pointer-events-none"></div>
              <Marker position="top-left" />
              <Marker position="top-right" />
              <Marker position="bottom-left" />
              <Marker position="bottom-right" />
              
              {/* Main dotted borders */}
              <div className="absolute inset-5 border border-dashed border-cyan-800/20 pointer-events-none"></div>
              
              {/* VIEWS */}
              {statsView === 'network' && (
                <div className="h-full">
                  <div className="flex items-center mb-4 bg-gradient-to-r from-cyan-900/10 to-transparent px-4 py-2">
                    <div className="text-xl font-light tracking-wider mr-3">CHIRAL NETWORK MAP</div>
                    <div className="text-xs opacity-70">
                      Strand connection visualization system
                    </div>
                  </div>
                  
                  <div className="flex-1 relative bg-black/10 h-[calc(100%-4rem)] overflow-hidden">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-3 h-px bg-cyan-400"></div>
                    <div className="absolute top-0 left-0 w-px h-3 bg-cyan-400"></div>
                    <div className="absolute top-0 right-0 w-3 h-px bg-cyan-400"></div>
                    <div className="absolute top-0 right-0 w-px h-3 bg-cyan-400"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-px bg-cyan-400"></div>
                    <div className="absolute bottom-0 left-0 w-px h-3 bg-cyan-400"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-px bg-cyan-400"></div>
                    <div className="absolute bottom-0 right-0 w-px h-3 bg-cyan-400"></div>
                    
                    {/* D3 Network Visualization - This will be rendered with useEffect */}
                    <NetworkGraph 
                      connections={connections} 
                      selectedConnectionId={selectedConnection?.id} 
                      setSelectedConnection={setSelectedConnection} 
                      getCurrentStrength={getCurrentStrength}
                      getConnectionLevel={getConnectionLevel}
                    />
                    
                    {/* Meta info overlay */}
                    <div className="absolute bottom-3 left-3 text-[10px] text-cyan-500/30 font-mono tracking-wider animate-pulse-slower">
                      NODES: {connections.length + 1} | STRANDS: {connections.length} | UCA CONNECTION: ACTIVE
                    </div>
                    
                    {/* Coordinate grid markers */}
                    <div className="absolute top-3 right-3 text-[10px] text-cyan-500/30 font-mono tracking-wider animate-pulse-slower">
                      SEC A3 | MAP REF: 1140.2-38
                    </div>
                    
                    {/* Info panel for selected connection */}
                    {selectedConnection && (
                      <div className="absolute right-4 bottom-10 w-80 bg-black/60 border border-cyan-900/50 p-3 backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm font-light tracking-wider">{selectedConnection.name}</div>
                          <div className="text-cyan-300">
                            {getConnectionLevel(getCurrentStrength(selectedConnection)).badge}
                          </div>
                        </div>
                        
                        <div className="mb-2 w-full bg-black/40 h-1.5 relative overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500/70 to-cyan-400"
                            style={{ width: `${Math.min(100, getCurrentStrength(selectedConnection))}%` }}
                          ></div>
                        </div>
                        
                        <div className="text-xs opacity-70 flex justify-between mb-3">
                          <div>Strength: {Math.round(getCurrentStrength(selectedConnection)).toString().padStart(2, '0')}</div>
                          <div>Half-life: {selectedConnection.halfLife}d</div>
                        </div>
                        
                        <div className="text-[10px] opacity-60">
                          Time to dormancy: {getDaysUntilThreshold(selectedConnection, 15)} days
                        </div>
                        
                        {getDaysUntilThreshold(selectedConnection, 15) <= 7 && (
                          <div className="mt-1.5 text-[10px] text-red-400 animate-pulse-fast">
                            WARNING: CRITICAL STRAND WEAKENING DETECTED
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {statsView === 'star-chart' && (
                <div className="h-full">
                  {selectedConnection ? (
                    <div className="p-4">
                      <div className="flex items-center mb-6 bg-gradient-to-r from-cyan-900/10 to-transparent px-4 py-2">
                        <div className="text-xl font-light tracking-wider mr-3">STAR CHART: {selectedConnection.name.toUpperCase()}</div>
                        <div className="text-xs opacity-70">
                          Connection quality metrics visualization
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 min-h-[300px] flex items-center justify-center bg-black/10 relative">
                          <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
                          <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
                          <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
                          <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
                          <div className="absolute bottom-0 left-0 w-2 h-px bg-cyan-400"></div>
                          <div className="absolute bottom-0 left-0 w-px h-2 bg-cyan-400"></div>
                          <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
                          <div className="absolute bottom-0 right-0 w-px h-2 bg-cyan-400"></div>
                          
                          <svg width="300" height="300" viewBox="0 0 300 300" className="mx-auto">
                            {/* Background circles */}
                            <circle cx="150" cy="150" r="120" fill="none" stroke="rgba(6, 182, 212, 0.1)" />
                            <circle cx="150" cy="150" r="90" fill="none" stroke="rgba(6, 182, 212, 0.1)" />
                            <circle cx="150" cy="150" r="60" fill="none" stroke="rgba(6, 182, 212, 0.1)" />
                            <circle cx="150" cy="150" r="30" fill="none" stroke="rgba(6, 182, 212, 0.1)" />
                            
                            {/* Axis lines */}
                            {Object.keys(selectedConnection.scores).map((key, i) => {
                              const angle = (i / Object.keys(selectedConnection.scores).length) * Math.PI * 2;
                              return (
                                <line 
                                  key={key}
                                  x1="150" 
                                  y1="150" 
                                  x2={150 + Math.cos(angle) * 120}
                                  y2={150 + Math.sin(angle) * 120}
                                  stroke="rgba(6, 182, 212, 0.3)"
                                  strokeDasharray="2,4"
                                />
                              );
                            })}
                            
                            {/* Data points */}
                            {Object.entries(selectedConnection.scores).map(([key, value], i) => {
                              const angle = (i / Object.keys(selectedConnection.scores).length) * Math.PI * 2;
                              const radius = (value / 100) * 120;
                              const x = 150 + Math.cos(angle) * radius;
                              const y = 150 + Math.sin(angle) * radius;
                              
                              return (
                                <g key={key}>
                                  <circle 
                                    cx={x} 
                                    cy={y} 
                                    r="4" 
                                    fill="rgba(6, 182, 212, 0.8)" 
                                  />
                                  <text 
                                    x={150 + Math.cos(angle) * 140} 
                                    y={150 + Math.sin(angle) * 140} 
                                    fill="rgba(6, 182, 212, 0.9)"
                                    fontSize="12"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                  >
                                    {key.toUpperCase()}
                                  </text>
                                  <text 
                                    x={x + Math.cos(angle) * 15} 
                                    y={y + Math.sin(angle) * 15} 
                                    fill="white"
                                    fontSize="10"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                  >
                                    {value}
                                  </text>
                                </g>
                              );
                            })}
                            
                            {/* Connect the points */}
                            <path 
                              d={
                                Object.entries(selectedConnection.scores).map(([key, value], i) => {
                                  const angle = (i / Object.keys(selectedConnection.scores).length) * Math.PI * 2;
                                  const radius = (value / 100) * 120;
                                  const x = 150 + Math.cos(angle) * radius;
                                  const y = 150 + Math.sin(angle) * radius;
                                  return (i === 0 ? "M" : "L") + x + "," + y;
                                }).join(" ") + "Z"
                              }
                              fill="rgba(6, 182, 212, 0.2)"
                              stroke="rgba(6, 182, 212, 0.6)"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </div>
                        
                        <div className="flex-1">
                          <div className="p-4 bg-black/20 h-full relative">
                            <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute bottom-0 left-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute bottom-0 right-0 w-px h-2 bg-cyan-400"></div>
                            
                            <div className="text-lg font-light mb-4">Connection Quality Metrics</div>
                            
                            {Object.entries(selectedConnection.scores).map(([key, value]) => (
                              <div key={key} className="mb-3">
                                <div className="flex justify-between">
                                  <div className="uppercase text-xs opacity-70">{key}</div>
                                  <div className="text-xl font-light tracking-tighter">{value.toString().padStart(2, '0')}</div>
                                </div>
                                <div className="mt-1 h-1 bg-black/30 w-full overflow-hidden">
                                  <div 
                                    className="h-full bg-cyan-500"
                                    style={{ width: `${value}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                            
                            <div className="mt-6 border-t border-dashed border-cyan-800/30 pt-4">
                              <div className="text-lg font-light mb-2">Metrics Analysis</div>
                              <div className="text-sm opacity-80">
                                The connection with {selectedConnection.name} shows 
                                {Math.max(...Object.values(selectedConnection.scores)) >= 80 ? 
                                  " excellent scores in " + Object.entries(selectedConnection.scores)
                                    .filter(([_, value]) => value >= 80)
                                    .map(([key]) => key)
                                    .join(", ") : 
                                  " good overall quality"}.
                                {Math.min(...Object.values(selectedConnection.scores)) <= 40 ? 
                                  " Improvement areas include " + Object.entries(selectedConnection.scores)
                                    .filter(([_, value]) => value <= 40)
                                    .map(([key]) => key)
                                    .join(", ") + "." : 
                                  ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center h-full flex items-center justify-center">
                      <div>
                        <div className="text-3xl mb-6 font-light animate-glow">STAR CHART</div>
                        <p className="text-cyan-300/60">Select connections from the sidebar</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {statsView === 'interaction-log' && (
                <div className="h-full">
                  <div className="flex items-center mb-6 bg-gradient-to-r from-cyan-900/10 to-transparent px-4 py-2">
                    <div className="text-xl font-light tracking-wider mr-3">INTERACTION LOG</div>
                    <div className="text-xs opacity-70">
                      {selectedConnection ? `${selectedConnection.name}'s interaction history` : 'All recent interactions'}
                    </div>
                  </div>
                  
                  <div className="space-y-4 px-4">
                    {activities
                      .filter(activity => !selectedConnection || activity.connectionId === selectedConnection.id)
                      .map(activity => {
                        const connection = connections.find(c => c.id === activity.connectionId);
                        return (
                          <div key={activity.id} className="p-4 bg-cyan-900/10 relative">
                            <div className="absolute top-0 left-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute top-0 left-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute top-0 right-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute top-0 right-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute bottom-0 left-0 w-px h-2 bg-cyan-400"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-px bg-cyan-400"></div>
                            <div className="absolute bottom-0 right-0 w-px h-2 bg-cyan-400"></div>
                            
                            <div className="grid grid-cols-4 gap-4">
                              <div className="col-span-1">
                                <div className="text-xs opacity-70 mb-1">DATE</div>
                                <div className="text-sm">{formatDate(activity.date)}</div>
                              </div>
                              
                              <div className="col-span-1">
                                <div className="text-xs opacity-70 mb-1">CONNECTION</div>
                                <div className="text-sm font-light">{connection?.name || 'Unknown'}</div>
                              </div>
                              
                              <div className="col-span-1">
                                <div className="text-xs opacity-70 mb-1">TYPE</div>
                                <div className="flex items-center">
                                  <span className="mr-2">{getActivityEmoji(activity.type)}</span>
                                  <span className="text-xs uppercase">{activity.type}</span>
                                </div>
                              </div>
                              
                              <div className="col-span-1">
                                <div className="text-xs opacity-70 mb-1">POINTS</div>
                                <div className="text-xl font-light tracking-tighter text-cyan-300">+{activity.points}</div>
                              </div>
                            </div>
                            
                            {activity.notes && (
                              <div className="mt-3 pt-3 border-t border-dashed border-cyan-800/30">
                                <div className="text-xs opacity-70 mb-1">NOTES</div>
                                <div className="text-sm">{activity.notes}</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    }
                    
                    {activities.filter(a => !selectedConnection || a.connectionId === selectedConnection.id).length === 0 && (
                      <div className="text-center p-8 bg-black/20">
                        <div className="text-lg font-light mb-2">No interactions found</div>
                        <p className="text-sm opacity-70">
                          {selectedConnection ? 
                            `No recorded interactions with ${selectedConnection.name}.` : 
                            'No interactions have been recorded yet.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {statsView === 'timefall-forecast' && (
                <TimefallForecast 
                  connections={connections} 
                  getCurrentStrength={getCurrentStrength}
                  getProjectedStrength={getProjectedStrength}
                  getDaysUntilThreshold={getDaysUntilThreshold}
                  getConnectionLevel={getConnectionLevel}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Detail panel - added glow and enhanced blur */}
        <div className={`w-72 ${borderStyle} p-4 overflow-y-auto relative backdrop-blur-md bg-black/30 shadow-[0_0_15px_rgba(0,180,230,0.1)] border-l border-cyan-900/20`}>
          {/* Subtle detail panel glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,200,255,0.03)_0%,_transparent_70%)] pointer-events-none"></div>
          <Marker position="top-left" />
          <Marker position="bottom-left" />
          
          {selectedConnection ? (
            <div>
              <div className="text-xs tracking-wider opacity-70 mb-2">
                <span className="mr-2">- - -</span>
                CONNECTION DETAILS
                <span className="ml-2">- - -</span>
              </div>
              <div className="text-2xl font-light tracking-wider mb-4 border-b border-dashed border-cyan-700/30 pb-2">{selectedConnection.name}</div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-2 relative bg-gradient-to-b from-cyan-900/20 to-transparent">
                  <Marker position="top-left" />
                  <Marker position="bottom-left" />
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="text-xs opacity-70">CURRENT STR</div>
                  <div className="text-2xl font-light tracking-tighter">{Math.round(getCurrentStrength(selectedConnection)).toString().padStart(2, '0')}</div>
                </div>
                <div className="p-2 relative bg-gradient-to-b from-cyan-900/20 to-transparent">
                  <Marker position="top-left" />
                  <Marker position="bottom-left" />
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="text-xs opacity-70">LEVEL</div>
                  <div className="text-2xl font-light">{getConnectionLevel(getCurrentStrength(selectedConnection)).badge}</div>
                </div>
                <div className="p-2 relative bg-gradient-to-b from-cyan-900/20 to-transparent">
                  <Marker position="top-left" />
                  <Marker position="bottom-left" />
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="text-xs opacity-70">HALF-LIFE</div>
                  <div className="text-2xl font-light tracking-tighter">{selectedConnection.halfLife.toString().padStart(2, '0')}d</div>
                </div>
                <div className="p-2 relative bg-gradient-to-b from-cyan-900/20 to-transparent">
                  <Marker position="top-left" />
                  <Marker position="bottom-left" />
                  <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                  <div className="text-xs opacity-70">LAST CONTACT</div>
                  <div className="text-2xl font-light tracking-tighter">{getDaysSinceContact(selectedConnection.lastContact).toString().padStart(2, '0')}d</div>
                </div>
              </div>
              
              <div className={dottedSeparator}></div>
              
              <div className="text-xs tracking-wider opacity-70 mb-2">
                <span className="mr-2">- - -</span>
                ADD INTERACTION
                <span className="ml-2">- - -</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-6">
                <button onClick={() => addInteraction(selectedConnection.id, 'react')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">↩️</div>
                  <div className="text-xs mt-1 font-light">+1</div>
                </button>
                <button onClick={() => addInteraction(selectedConnection.id, 'text')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">💬</div>
                  <div className="text-xs mt-1 font-light">+3</div>
                </button>
                <button onClick={() => addInteraction(selectedConnection.id, 'call')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">📞</div>
                  <div className="text-xs mt-1 font-light">+8</div>
                </button>
                <button onClick={() => addInteraction(selectedConnection.id, 'game')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">🪄</div>
                  <div className="text-xs mt-1 font-light">+10</div>
                </button>
                <button onClick={() => addInteraction(selectedConnection.id, 'in-person')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">☕</div>
                  <div className="text-xs mt-1 font-light">+15</div>
                </button>
                <button onClick={() => addInteraction(selectedConnection.id, 'day-trip')}
                  className="p-2 hover:bg-cyan-900/30 hover:shadow-[0_0_10px_rgba(0,200,255,0.15)] text-center relative transition-all duration-300">
                  <Marker position="top-left" />
                  <Marker position="bottom-right" />
                  <div className="text-lg">🌄</div>
                  <div className="text-xs mt-1 font-light">+25</div>
                </button>
              </div>
              
              <div className={dottedSeparator}></div>
              
              <div className="text-xs tracking-wider opacity-70 mb-2">
                <span className="mr-2">- - -</span>
                RECENT ACTIVITY
                <span className="ml-2">- - -</span>
              </div>
              <div className="space-y-2">
                {activities
                  .filter(activity => activity.connectionId === selectedConnection.id)
                  .slice(0, 3)
                  .map(activity => (
                    <div key={activity.id} className="p-2 text-xs relative bg-gradient-to-b from-cyan-900/10 to-transparent">
                      <Marker position="top-left" />
                      <Marker position="bottom-left" />
                      <div className="absolute top-0 right-0 w-1 h-1 bg-cyan-400"></div>
                      <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                      <div className="flex justify-between">
                        <div>{getActivityEmoji(activity.type)} {activity.type.toUpperCase()}</div>
                        <div className="text-base font-light">+{activity.points}</div>
                      </div>
                      <div className="opacity-70 mt-1">
                        {formatDate(activity.date)}
                      </div>
                      {activity.notes && (
                        <div className="mt-1 border-t border-dashed border-cyan-800/50 pt-1">
                          {activity.notes}
                        </div>
                      )}
                    </div>
                  ))
                }
                
                {activities.filter(a => a.connectionId === selectedConnection.id).length === 0 && (
                  <div className="text-xs opacity-50 text-center p-2">
                    No activity recorded
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-cyan-500 opacity-50">
              <div className="text-center">
                <div className="text-lg font-light tracking-wider">SELECT A CONNECTION</div>
                <div className="text-xs mt-2">TO VIEW DETAILS</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer - added glow effect */}
      <footer className={`${borderStyle} p-2 text-xs text-center text-cyan-500 flex justify-center items-center space-x-4 backdrop-blur-md bg-black/40 shadow-[0_0_15px_rgba(0,180,230,0.15)] relative overflow-hidden`}>
        {/* Subtle footer glow */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
        <span>STRAND FRIENDS v1.0</span>
        <span>•</span>
        <span>PORTER ID: DS-34601</span>
        <span>•</span>
        <span>CURRENT DATE: {formatDate(new Date())}</span>
      </footer>
      
      {/* Add Connection Modal */}
      {showAddConnectionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-96 bg-black/80 border border-cyan-900/50 p-4 relative">
            <Marker position="top-left" />
            <Marker position="top-right" />
            <Marker position="bottom-left" />
            <Marker position="bottom-right" />
            
            {/* Dashed border inside */}
            <div className="absolute inset-5 border border-dashed border-cyan-800/20 pointer-events-none"></div>
            
            <button 
              onClick={() => setShowAddConnectionModal(false)}
              className="absolute top-2 right-2 text-cyan-500 hover:text-cyan-300 hover:shadow-[0_0_8px_rgba(0,200,255,0.4)] transition-all duration-300"
            >
              ×
            </button>
            
            <div className="text-center mb-4">
              <div className="text-lg font-light tracking-widest text-cyan-300">NEW CONNECTION</div>
              <div className="text-xs opacity-70">ESTABLISH BRIDGE LINK</div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs tracking-wider opacity-70 mb-1 block">NAME</label>
                <input
                  type="text"
                  value={newConnection.name}
                  onChange={(e) => updateNewConnectionField('name', e.target.value)}
                  className="w-full bg-cyan-900/10 border border-cyan-800/30 p-2 text-cyan-100 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
              
              <div className={dottedSeparator}></div>
              
              <div>
                <label className="text-xs tracking-wider opacity-70 mb-1 block">INITIAL STRENGTH</label>
                <div className="flex items-center">
                  <input
                    type="range"
                    min="15"
                    max="100"
                    value={newConnection.strength}
                    onChange={(e) => updateNewConnectionField('strength', parseInt(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="ml-2 font-light text-xl tracking-tighter">
                    {newConnection.strength.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-xs tracking-wider opacity-70 mb-1 block">HALF-LIFE (DAYS)</label>
                <div className="flex space-x-2">
                  {[14, 21, 30, 60, 90].map(days => (
                    <button
                      key={days}
                      onClick={() => updateNewConnectionField('halfLife', days)}
                      className={`flex-1 py-1 px-2 text-center relative ${newConnection.halfLife === days ? 'bg-cyan-900/50 text-cyan-100' : 'bg-cyan-900/10 hover:bg-cyan-900/30'}`}
                    >
                      {newConnection.halfLife === days && (
                        <>
                          <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-400"></div>
                          <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-400"></div>
                        </>
                      )}
                      {days}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className={dottedSeparator}></div>
              
              <div>
                <label className="text-xs tracking-wider opacity-70 mb-1 block">CONNECTION METRICS</label>
                <div className="space-y-2">
                  {Object.entries(newConnection.scores).map(([key, value]) => (
                    <div key={key} className="flex items-center">
                      <div className="w-32 text-xs opacity-70 uppercase">{key}</div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => updateNewConnectionScore(key, e.target.value)}
                        className="flex-1 accent-cyan-500"
                      />
                      <span className="ml-2 w-8 text-right font-light">
                        {value.toString().padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={dottedSeparator}></div>
              
              <div className="pt-4 flex space-x-2">
                <button
                  onClick={() => setShowAddConnectionModal(false)}
                  className="flex-1 py-2 bg-transparent border border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/20 relative"
                >
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-800"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-800"></div>
                  CANCEL
                </button>
                <button
                  onClick={handleAddConnection}
                  disabled={!newConnection.name.trim()}
                  className={`flex-1 py-2 bg-cyan-900/30 text-cyan-100 border border-cyan-700/50 ${!newConnection.name.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-800/40'} relative`}
                >
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-500"></div>
                  <div className="absolute bottom-0 right-0 w-1 h-1 bg-cyan-500"></div>
                  ESTABLISH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
const getActivityEmoji = (type: string): string => {
  switch(type) {
    case 'react': return '↩️';
    case 'text': return '💬';
    case 'call': return '📞';
    case 'game': return '🪄';
    case 'in-person': return '☕';
    case 'day-trip': return '🌄';
    default: return '📝';
  }
};

const formatDate = (date: Date): string => {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }
};

export default StrandSystem;