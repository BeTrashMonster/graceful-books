/**
 * Financial Web Graph Component
 *
 * Force-directed graph visualization showing where CPG money flows.
 * Categories are nodes sized by spending, connected by product recipes.
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphConnection } from '../../services/cpg/financialWebData.service';
import styles from './FinancialWebGraph.module.css';

interface FinancialWebGraphProps {
  nodes: GraphNode[];
  connections: GraphConnection[];
  onNodeClick: (nodeId: string, nodeType: string) => void;
  onConnectionClick?: (sourceId: string, targetId: string, productIds: string[]) => void;
  width?: number;
  height?: number;
}

interface D3Node extends d3.SimulationNodeDatum, GraphNode {
  x?: number;
  y?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: D3Node | string;
  target: D3Node | string;
  productCount: number;
  products: Array<{ id: string; name: string }>;
}

export function FinancialWebGraph({
  nodes,
  connections,
  onNodeClick,
  onConnectionClick,
  width = 1200,
  height = 700,
}: FinancialWebGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
    isLine?: boolean;
  }>({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Convert nodes and links to D3 format
    const d3Nodes: D3Node[] = nodes.map(n => ({ ...n }));
    const d3Links: D3Link[] = connections.map(c => ({
      source: c.source,
      target: c.target,
      productCount: c.productCount,
      products: c.products,
    }));

    // Calculate node sizes based on spending
    const maxSpending = d3.max(d3Nodes, d => parseFloat(d.totalSpent)) || 1;
    const nodeScale = d3.scaleSqrt()
      .domain([0, maxSpending])
      .range([20, 80]); // Min and max radius

    // Create force simulation with stronger repulsion to spread nodes apart
    const simulation = d3.forceSimulation(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id(d => d.id)
        .distance(250) // Increased from 200
        .strength(0.3)) // Reduced from 0.5 for looser connections
      .force('charge', d3.forceManyBody().strength(-1500)) // Increased repulsion from -800
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius(d => nodeScale(parseFloat(d.totalSpent)) + 40)) // Increased spacing from 20
      // Keep all nodes within viewport bounds with stronger pull
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1));

    // Draw links with more dramatic weight differences
    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('class', styles.link)
      .attr('stroke-width', d => Math.max(2, Math.sqrt(d.productCount) * 5)) // Increased multiplier to 5, min width 2
      .style('cursor', onConnectionClick ? 'pointer' : 'default')
      .on('mouseover', function(event, d) {
        // Highlight line
        d3.select(this).attr('class', `${styles.link} ${styles.linkHover}`);

        // Show tooltip with products
        const productList = d.products.map(p => p.name).join(', ');
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY - 10,
          content: `${d.productCount} product${d.productCount > 1 ? 's' : ''}:\n${productList}`,
          isLine: true,
        });
      })
      .on('mouseout', function() {
        d3.select(this).attr('class', styles.link);
        setTooltip(prev => ({ ...prev, visible: false }));
      })
      .on('click', function(event, d) {
        if (onConnectionClick) {
          event.stopPropagation();
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
          const targetId = typeof d.target === 'string' ? d.target : d.target.id;
          const productIds = d.products.map(p => p.id);
          onConnectionClick(sourceId, targetId, productIds);
        }
      });

    // Draw node groups (circle + text)
    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('class', styles.nodeGroup)
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Node circles
    node.append('circle')
      .attr('class', d => d.isActive ? styles.nodeActive : styles.nodeInactive)
      .attr('r', d => nodeScale(parseFloat(d.totalSpent)))
      .attr('data-type', d => d.type)
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d.id, d.type);
      })
      .on('mouseover', function(event, d) {
        // Grow node slightly
        d3.select(this).transition().duration(200).attr('r', nodeScale(parseFloat(d.totalSpent)) * 1.1);

        // Show tooltip
        const tooltipContent = d.type === 'category'
          ? `${d.name}\n$${parseFloat(d.totalSpent).toLocaleString()} spent\n${d.invoiceCount} invoices`
          : `${d.name}\n$${parseFloat(d.totalSpent).toLocaleString()} total`;

        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY - 10,
          content: tooltipContent,
        });
      })
      .on('mouseout', function(event, d) {
        d3.select(this).transition().duration(200).attr('r', nodeScale(parseFloat(d.totalSpent)));
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // Node labels
    node.append('text')
      .attr('class', styles.nodeLabel)
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeScale(parseFloat(d.totalSpent)) + 20)
      .text(d => d.name)
      .style('pointer-events', 'none');

    // Removed emoji icons for operational nodes per user request

    // Dollar amount labels (only for active nodes with spending)
    // Font size proportional to node size for better readability
    node.filter(d => d.isActive && parseFloat(d.totalSpent) > 0)
      .append('text')
      .attr('class', styles.nodeAmount)
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em') // Back to centered position
      .text(d => `$${parseFloat(d.totalSpent).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`)
      .style('pointer-events', 'none')
      .style('font-size', d => {
        // Font size proportional to node size (12px to 20px)
        const spending = parseFloat(d.totalSpent);
        const fontScale = d3.scaleLinear()
          .domain([0, maxSpending])
          .range([12, 20]);
        return `${fontScale(spending)}px`;
      });

    // Update positions on simulation tick with boundary constraints
    simulation.on('tick', () => {
      // Constrain nodes to viewport bounds
      d3Nodes.forEach(d => {
        const radius = nodeScale(parseFloat(d.totalSpent)) + 40;
        d.x = Math.max(radius, Math.min(width - radius, d.x || width / 2));
        d.y = Math.max(radius, Math.min(height - radius, d.y || height / 2));
      });

      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, connections, onNodeClick, width, height]);

  return (
    <div className={styles.container}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={styles.svg}
      />
      {tooltip.visible && (
        <div
          className={tooltip.isLine ? styles.tooltipLine : styles.tooltip}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.content.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
