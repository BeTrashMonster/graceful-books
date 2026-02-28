import { useRef, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { ecosystemNodes, ecosystemLinks, EcosystemNode } from '../data/ecosystemData';
import styles from './EcosystemGraph.module.css';

interface GraphNode extends EcosystemNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'integrated' | 'standalone' | 'accountant';
}

export function EcosystemGraph() {
  const graphRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<EcosystemNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Give nodes fixed positions - perfect for presentation!
  const positionedNodes = ecosystemNodes.map((node, idx) => {
    const graphNode = { ...node } as GraphNode;

    // Set FIXED positions in a circle pattern
    if (node.id === 'bookkeeping') {
      graphNode.fx = 0;
      graphNode.fy = 0;
      graphNode.x = 0;
      graphNode.y = 0;
    } else if (node.id === 'budgeting') {
      graphNode.fx = -130;
      graphNode.fy = -85;
      graphNode.x = -130;
      graphNode.y = -85;
    } else if (node.id === 'debt') {
      graphNode.fx = 130;
      graphNode.fy = -85;
      graphNode.x = 130;
      graphNode.y = -85;
    } else if (node.id === 'service-job') {
      graphNode.fx = -130;
      graphNode.fy = 85;
      graphNode.x = -130;
      graphNode.y = 85;
    } else if (node.id === 'cpg') {
      graphNode.fx = 130;
      graphNode.fy = 85;
      graphNode.x = 130;
      graphNode.y = 85;
    } else if (node.id === 'accountant') {
      graphNode.fx = 220;
      graphNode.fy = 0;
      graphNode.x = 220;
      graphNode.y = 0;
    }

    return graphNode;
  });

  const graphData = {
    nodes: positionedNodes,
    links: ecosystemLinks as GraphLink[]
  };

  // Custom node rendering
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = node.type === 'hub' ? 16 : 12;
    const nodeSize = node.type === 'hub' ? 30 : node.type === 'accountant' ? 25 : 20;

    // Draw node circle with glow effect
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);

    // Glow effect for hub and hovered nodes
    if (node.type === 'hub' || hoveredNode === node.id) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 20;
    }

    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw ring for accountant node (separate orbit)
    if (node.type === 'accountant') {
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw label
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';

    // Handle multi-line text
    const lines = label.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        node.x || 0,
        (node.y || 0) + (i - (lines.length - 1) / 2) * (fontSize + 2)
      );
    });

    // Draw price below node
    if (node.type !== 'hub') {
      ctx.font = `10px Inter, sans-serif`;
      ctx.fillStyle = '#D1D5DB';
      ctx.fillText(
        node.price,
        node.x || 0,
        (node.y || 0) + nodeSize + 15
      );
    }
  }, [hoveredNode]);

  // Custom link rendering
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const sourceNode = typeof link.source === 'object' ? link.source : null;
    const targetNode = typeof link.target === 'object' ? link.target : null;

    if (!sourceNode || !targetNode) return;

    ctx.beginPath();
    ctx.moveTo(sourceNode.x || 0, sourceNode.y || 0);
    ctx.lineTo(targetNode.x || 0, targetNode.y || 0);

    // Different styles for different connection types
    if (link.type === 'accountant') {
      ctx.strokeStyle = '#EF444440'; // Semi-transparent red
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
    } else {
      ctx.strokeStyle = '#9CA3AF40'; // Semi-transparent gray
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id || null);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>The Constellation</h1>
        <p className={styles.subtitle}>
          A Progressive Financial Ecosystem • No Upsells • Everything Unfurls When You're Ready
        </p>
      </div>

      <div className={styles.graphContainer}>
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel={() => ''}
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="#0F172A"
          linkDirectionalParticles={0}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.4}
          cooldownTime={4000}
          warmupTicks={200}
          nodeRelSize={6}
          linkDistance={140}
          d3Force={(d3Forces: any) => {
            d3Forces.charge.strength(-600);
            d3Forces.link.distance(() => 140);
            // Add collision detection to prevent overlap
            d3Forces.collision = forceCollide<GraphNode>()
              .radius((node: GraphNode) => {
                const nodeSize = node.type === 'hub' ? 35 : node.type === 'accountant' ? 30 : 25;
                return nodeSize + 50; // Node size + padding
              })
              .strength(1);
          }}
        />
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className={styles.detailPanel}>
          <button className={styles.closeButton} onClick={closeDetails}>
            ✕
          </button>

          <div className={styles.detailHeader}>
            <div
              className={styles.detailIcon}
              style={{ backgroundColor: selectedNode.color }}
            />
            <div>
              <h2 className={styles.detailTitle}>{selectedNode.name.replace('\n', ' ')}</h2>
              <p className={styles.detailPrice}>{selectedNode.price}</p>
            </div>
          </div>

          <p className={styles.detailDescription}>{selectedNode.description}</p>

          <div className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>Key Features</h3>
            <ul className={styles.featureList}>
              {selectedNode.keyFeatures.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className={styles.detailSection}>
            <h3 className={styles.sectionTitle}>Availability</h3>
            <div className={styles.availabilityGrid}>
              <div className={styles.availabilityItem}>
                <span className={styles.availabilityLabel}>Standalone:</span>
                <span className={selectedNode.standaloneAvailable ? styles.yes : styles.no}>
                  {selectedNode.standaloneAvailable ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div className={styles.availabilityItem}>
                <span className={styles.availabilityLabel}>Included in Bookkeeping:</span>
                <span className={selectedNode.integratedInBookkeeping ? styles.yes : styles.no}>
                  {selectedNode.integratedInBookkeeping ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.charityBadge}>
            💚 {selectedNode.charityContribution}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: '#7C3AED' }} />
          <span>Hub (Bookkeeping)</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: '#10B981' }} />
          <span>Cash Flow Modules</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: '#F59E0B' }} />
          <span>Operations Modules</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: '#EF4444', border: '2px dashed #EF4444' }} />
          <span>Accountant Portal (Separate)</span>
        </div>
      </div>
    </div>
  );
}
