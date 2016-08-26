function heatmap(selector, data, options) {

  // ==== BEGIN HELPERS =================================
  
  function htmlEscape(str) {
    return (str+"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
    
  d3.selectAll(".outer").remove();

        // Opera 8.0+
  var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
      // Firefox 1.0+
  var isFirefox = typeof InstallTrigger !== 'undefined';
      // At least Safari 3+: "[object HTMLElementConstructor]"
  var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
      // Internet Explorer 6-11
  var isIE = /*@cc_on!@*/false || !!document.documentMode;
      // Edge 20+
  var isEdge = !isIE && !!window.StyleMedia;
      // Chrome 1+
  var isChrome = !!window.chrome && !!window.chrome.webstore;
      // Blink engine detection
  var isBlink = (isChrome || isOpera) && !!window.CSS;


  // Given a list of widths/heights and a total width/height, provides
  // easy access to the absolute top/left/width/height of any individual
  // grid cell. Optionally, a single cell can be specified as a "fill"
  // cell, meaning it will take up any remaining width/height.
  // 
  // rows and cols are arrays that contain numeric pixel dimensions,
  // and up to one "*" value.
  function GridSizer(widths, heights, /*optional*/ totalWidth, /*optional*/ totalHeight) {
    this.widths = widths;
    this.heights = heights;
  
    var fillColIndex = null;
    var fillRowIndex = null;
    var usedWidth = 0;
    var usedHeight = 0;
    var i;
    for (i = 0; i < widths.length; i++) {
      if (widths[i] === "*") {
        if (fillColIndex !== null) {
          throw new Error("Only one column can be designated as fill");
        }
        fillColIndex = i;
      } else {
        usedWidth += widths[i];
      }
    }
    if (fillColIndex !== null) {
      widths[fillColIndex] = totalWidth - usedWidth;
    } else {
      if (typeof(totalWidth) === "number" && totalWidth !== usedWidth) {
        throw new Error("Column widths don't add up to total width");
      }
    }
    for (i = 0; i < heights.length; i++) {
      if (heights[i] === "*") {
        if (fillRowIndex !== null) {
          throw new Error("Only one row can be designated as fill");
        }
        fillRowIndex = i;
      } else {
        usedHeight += heights[i];
      }
    }
    if (fillRowIndex !== null) {
      heights[fillRowIndex] = totalHeight - usedHeight;
    } else {
      if (typeof(totalHeight) === "number" && totalHeight !== usedHeight) {
        throw new Error("Column heights don't add up to total height");
      }
    }
  }
  
  GridSizer.prototype.getCellBounds = function(x, y) {
    if (x < 0 || x >= this.widths.length || y < 0 || y >= this.heights.length)
      throw new Error("Invalid cell bounds");
  
    var left = 0;
    for (var i = 0; i < x; i++) {
      left += this.widths[i];
    }
  
    var top = 0;
    for (var j = 0; j < y; j++) {
      top += this.heights[j];
    }
  
    return {
      width: this.widths[x],
      height: this.heights[y],
      top: top,
      left: left
    }
  }
  
  // ==== END HELPERS ===================================


  var el = d3.select(selector);

  var outer = el.append("div").classed("outer", true);

  var title = outer.append("svg")
    .classed("title", true)
    .attr("height", "50")
    .attr("width", "40%")

  title.append('text')
    // .attr('width', 300)
    .classed('plot_title', true)
    .text(data.title)
    .attr('x', '50%')
    .attr('y', '50%')
    // .fill("#000000");


  var colorkey = outer.append("svg")
    .classed("colorkey", true)
    .append("g")
    .attr("x", 0)
    .attr("y", 0)


  var inner = outer.append("div").classed("inner", true);


  var bbox = inner.node().getBoundingClientRect();

  var Controller = function() {
    this._events = d3.dispatch("highlight", "datapoint_hover", "transform");
    this._highlight = {x: null, y: null};
    this._datapoint_hover = {x: null, y: null, value: null};
    this._transform = null;
  };
  (function() {
    this.highlight = function(x, y) {
      // Copy for safety
      if (!arguments.length) return {x: this._highlight.x, y: this._highlight.y};

      if (arguments.length == 1) {
        this._highlight = x;
      } else {
        this._highlight = {x: x, y: y};
      }
      this._events.highlight.call(this, this._highlight);
    };

    this.datapoint_hover = function(_) {
      if (!arguments.length) return this._datapoint_hover;
      
      this._datapoint_hover = _;
      this._events.datapoint_hover.call(this, _);
    };

    this.transform = function(_) {
      if (!arguments.length) return this._transform;
      this._transform = _;
      this._events.transform.call(this, _);
    };

    this.on = function(evt, callback) {
      this._events.on(evt, callback);
    };
  }).call(Controller.prototype);

  var controller = new Controller();

  // Set option defaults
  var opts = {};
  options = options || {};
  opts.width = options.width || bbox.width;
  opts.height = options.height || bbox.height;
  opts.xclust_height = options.xclust_height || opts.height * 0.12;
  opts.yclust_width = options.yclust_width || opts.width * 0.12;
  opts.link_color = opts.link_color || "#AAA";
  opts.xaxis_height = options.xaxis_height || 80;
  opts.yaxis_width = options.yaxis_width || 120;
  opts.ycolors_width = options.ycolors_width;
  opts.xcolors_height = options.xcolors_height;
  opts.axis_padding = options.axis_padding || 6;
  opts.show_grid = options.show_grid;
  if (typeof(opts.show_grid) === 'undefined') {
    opts.show_grid = true;
  }
  opts.brush_color = options.brush_color || "#0000FF";
  opts.xaxis_font_size = options.xaxis_font_size;
  opts.yaxis_font_size = options.yaxis_font_size;
  opts.anim_duration = options.anim_duration;

  // AOC
  opts.breaks = options.breaks;
  opts.symbreaks = options.symbreaks;
  opts.colors = options.colors;
  opts.colorkey_title = options.colorkey_title;
  opts.row_cols = options.row_cols;
  opts.col_cols = options.col_cols;
  opts.show_color_legend = options.show_color_legend;
  opts.na_color = options.na_color;

  if (typeof(opts.anim_duration) === 'undefined') {
    opts.anim_duration = 500;
  }

  if (!data.rows)
    opts.yclust_width = 0;
  if (!data.cols)
    opts.xclust_height = 0;
  if (!data.rowcolors) {
    opts.ycolors_width = 0;
  } else if (typeof(opts.ycolors_width) === 'undefined') {
    opts.ycolors_width = data.rowcolors.length * 20;
  }
  if (!data.colcolors) {
    opts.xcolors_height = 0;
  } else if (typeof(opts.xcolors_height) === 'undefined') {
    opts.xcolors_height = data.colcolors.length * 20;
  }
  
  if (typeof(opts.show_grid) === 'number') {
    opts.spacing = opts.show_grid;
  } else if (!!opts.show_grid) {
    opts.spacing = 0.25;
  } else {
    opts.spacing = 0;
  }
  
  var gridSizer = new GridSizer(
    [opts.yclust_width, opts.ycolors_width, "*", opts.yaxis_width],
    [opts.xclust_height, opts.xcolors_height, "*", opts.xaxis_height],
    opts.width,
    opts.height
  );

  var colormapBounds = gridSizer.getCellBounds(2, 2);
  var colDendBounds = gridSizer.getCellBounds(2, 0);
  var colColorsBounds = gridSizer.getCellBounds(2, 1);
  var rowDendBounds = gridSizer.getCellBounds(0, 2);
  var rowColorsBounds = gridSizer.getCellBounds(1, 2);
  var yaxisBounds = gridSizer.getCellBounds(3, 2);
  var xaxisBounds = gridSizer.getCellBounds(2, 3);

  function cssify(styles) {
    return {
      position: "absolute",
      top: styles.top + "px",
      left: styles.left + "px",
      width: styles.width + "px",
      height: styles.height + "px"
    };
  }

  // Create DOM structure
  (function() {


    var legend_size = gridSizer.getCellBounds(1,0);
    d3.select('.colorkey')
      .attr('width', legend_size['height'] * 2)
      .attr('height', legend_size['height'] * 2);

    var colDend = inner.append("svg").classed("dendrogram colDend", true).style(cssify(colDendBounds));
    var rowDend = inner.append("svg").classed("dendrogram rowDend", true).style(cssify(rowDendBounds));
    var colColors = inner.append("svg").classed("dendrogram colColors", true).style(cssify(colColorsBounds));
    var rowColors = inner.append("svg").classed("dendrogram rowColors", true).style(cssify(rowColorsBounds));
    var colmap = inner.append("svg").classed("colormap", true).style(cssify(colormapBounds));
    var xaxis = inner.append("svg").classed("axis xaxis", true).style(cssify(xaxisBounds));
    var yaxis = inner.append("svg").classed("axis yaxis", true).style(cssify(yaxisBounds));
    
    // Hack the width of the x-axis to allow x-overflow of rotated labels; the
    // QtWebkit viewer won't allow svg elements to overflow:visible.
    xaxis.style("width", (opts.width - opts.yclust_width) + "px");
    xaxis
      .append("defs")
        .append("clipPath").attr("id", "xaxis-clip")
          .append("polygon")
            .attr("points", "" + [
              [0, 0],
              [xaxisBounds.width, 0],
              [xaxisBounds.width + yaxisBounds.width, xaxisBounds.height],
              [0, xaxisBounds.height]
            ]);
    xaxis.node(0).setAttribute("clip-path", "url(#xaxis-clip)");

    inner.on("click", function() {
      controller.highlight(null, null);
    });
    controller.on('highlight.inner', function(hl) {
      inner.classed('highlighting',
        typeof(hl.x) === 'number' || typeof(hl.y) === 'number');
    });
  })();
  
  var row = !data.rows ? null : dendrogram(el.select('svg.rowDend'), data.rows, false, rowDendBounds.width, rowDendBounds.height, opts.axis_padding);

  var rowColorsLabel = opts.row_cols == null ? null : 
      d3.select('.inner').append('svg')
      .classed('rowColorsLabel', true)
      .attr("height", "100%")
      .attr("width", "20%");


  var rowColors = !data.rowcolors ? null : rowColorLabels(el.select('svg.rowColors'), data.rowcolors, rowColorsBounds.width, rowColorsBounds.height, opts.axis_padding, opts.row_cols);


  var colColorsLabel = opts.col_cols == null ? null : 
    d3.select('.inner').append('svg')
      .classed('colColorsLabel', true)
      .attr("height", "100%")
      .attr("width", "20%");

  var colColors = !data.colcolors ? null : colColorLabels(el.select('svg.colColors'), data.colcolors, colColorsBounds.width, colColorsBounds.height, opts.axis_padding, opts.col_cols);

  var col = !data.cols ? null : dendrogram(el.select('svg.colDend'), data.cols, true, colDendBounds.width, colDendBounds.height, opts.axis_padding);
  var colormap = colormap(el.select('svg.colormap'), data.matrix, colormapBounds.width, colormapBounds.height);
  var xax = axisLabels(el.select('svg.xaxis'), data.cols || data.matrix.cols, true, xaxisBounds.width, xaxisBounds.height, opts.axis_padding);
  var yax = axisLabels(el.select('svg.yaxis'), data.rows || data.matrix.rows, false, yaxisBounds.width, yaxisBounds.height, opts.axis_padding);
  
  function colormap(svg, data, width, height) {
    // Check for no data
    if (data.length === 0)
      return function() {};

  	if (!opts.show_grid) {
        svg.style("shape-rendering", "crispEdges");
  	}


    var cols = data.dim[1];
    var rows = data.dim[0];

    var max = d3.max(data.x);
    var min = d3.min(data.x);

    if(opts.symbreaks) {
      min = Math.abs(max) > Math.abs(min) ? (0 - max) : min
      max = Math.abs(min) >= Math.abs(max) ? max : min
    }


    var interval = (max - min) / opts.breaks;
    var n = min;
    var intervals = [];
    while(n <= max) {
      intervals.push(n);
      n += interval;
    }     
    // intervals.push(0);
    // intervals.sort(function (a,b) { return a - b; });;


    var colorscale = d3.scale.linear()
      .domain(intervals)
      .range(opts.colors);

    if(opts.show_color_legend) {
      var legend_width = d3.select('.colorkey').attr('width');
      var legend_height = d3.select('.colorkey').attr('height');

      // http://bl.ocks.org/mbostock/3048450
      var hist = d3.layout.histogram(data.x)
        .bins(opts.breaks)

      var blockwidth = legend_width / opts.breaks;

      var legendscale = d3.scale.linear()
        .domain([min, max])
        .range([0, (legend_width - blockwidth - 1)]);

      // Color ramp place 
      var xAxis = d3.svg.axis()
        .ticks(5)
        .scale(legendscale)
        .orient("bottom")
        .tickSize(10);


      // (JS shortcut)
      var legend_key = d3.select('.colorkey')
        .append("g")
        .attr("class", "legend_key")
        .attr('width', '100%')
        .attr("transform", "translate(0," + (legend_height /  2) + ")")

      d3.select('.colorkey').append('text')
        .classed('colorkey_title', true)
        .text(opts.colorkey_title)
        .attr('x', '50%')
        .attr('y', '95%')
        .attr('padding-top', '1px');

      var histdata = d3.layout.histogram()
        .bins(intervals)(data.x);


      var histy = d3.scale.linear()
        .domain([0, d3.max(histdata, function(d) { return d.y; })])
        .range([0, legend_height / 2]);

    var bar = legend_key.selectAll(".bar")
        .data(histdata)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("y", function(d) {
          return(-histy(d.y))
        })
        .attr("x", function(d) {
          return(legendscale(d.x));
        })
        .attr("width", blockwidth)
        .attr("height", function(d) {
          return(histy(d.y))})
        .attr("fill", function(d) {
          return(colorscale(d.x))
        });

    legend_key.append("rect")
      .attr("width", legend_width - blockwidth)
      .attr("height", 8)
      .attr("fill", "transparent")
      .classed("legendbox", true)

    legend_key.selectAll(".colorkey")
      .data(intervals)
      .enter().append("rect")
      .attr("height", 8)
      .attr("x", function(d) {
        return (legendscale(d)); 
      })
      .attr("width", blockwidth)
      .attr("fill", function(d) { 
        return(colorscale(d)); 
      });
    }

    legend_key.call(xAxis);

    
    
    var x = d3.scale.linear().domain([0, cols]).range([0, width]);
    var y = d3.scale.linear().domain([0, rows]).range([0, height]);
    var tip = d3.tip()
        .attr('class', 'd3heatmap-tip')
        .html(function(d, i) {
          return "<table>" + 
            "<tr><th align=\"right\">Row</th><td>" + htmlEscape(data.rows[d.row]) + "</td></tr>" +
            "<tr><th align=\"right\">Column</th><td>" + htmlEscape(data.cols[d.col]) + "</td></tr>" +
            "<tr><th align=\"right\">Value</th><td>" + htmlEscape(d.label) + "</td></tr>" +
            "</table>";
        })
        .direction("se")
        .style("position", "fixed");
    var current_origin = [0,0];
    var brush = d3.svg.brush()
        .x(x)
        .y(y)
        .clamp([true, true])
        .on('brush', function() {
          var extent = brush.extent();
          extent[0][0] = Math.round(extent[0][0]);
          extent[0][1] = Math.round(extent[0][1]);
          extent[1][0] = Math.round(extent[1][0]);
          extent[1][1] = Math.round(extent[1][1]);
          d3.select(this).call(brush.extent(extent));
        })
        .on('brushend', function() {

          if (brush.empty()) {
            controller.transform({
              scale: [1,1],
              translate: [0,0],
              extent: [[0,0],[cols,rows]]
            });
            current_origin = [0,0];
          } else {
            var tf = controller.transform();
            var ex = brush.extent();
            var scale = [
              cols / (ex[1][0] - ex[0][0]),
              rows / (ex[1][1] - ex[0][1])
            ];
            var translate = [
              ex[0][0] * (width / cols) * scale[0] * -1,
              ex[0][1] * (height / rows) * scale[1] * -1
            ];
            current_origin = ex[0];
            controller.transform({scale: scale, translate: translate, extent: ex});
          }
          brush.clear();
          d3.select(this).call(brush).select(".brush .extent")
              .style({fill: opts.brush_color, stroke: opts.brush_color});
        });
    svg = svg
        .attr("width", width)
        .attr("height", height);
    var rect = svg.selectAll("rect").data(data.x);
    rect.enter().append("rect").classed("datapt", true)
        .property("colIndex", function(d, i) { return i % cols; })
        .property("rowIndex", function(d, i) { return Math.floor(i / cols); })
        .property("value", function(d, i) { return d; })
        .attr("fill", function(d) {
          return(
            d == null ? 
              opts.na_color : colorscale(d)
            );
          }
        );
    rect.exit().remove();
    rect.append("title")
        .text(function(d, i) { return d; });
    rect.call(tip);

    function draw(selection) {
      selection
          .attr("x", function(d, i) {
            return x(i % cols);
          })
          .attr("y", function(d, i) {
            return y(Math.floor(i / cols));
          })
          .attr("width", (x(1) - x(0)) - opts.spacing)
          .attr("height", (y(1) - y(0)) - opts.spacing);
    }

    draw(rect);

    controller.on('transform.colormap', function(_) {
      x.range([_.translate[0], width * _.scale[0] + _.translate[0]]);
      y.range([_.translate[1], height * _.scale[1] + _.translate[1]]);
      draw(rect.transition().duration(opts.anim_duration).ease("linear"));
    });
    

    var brushG = svg.append("g")
        .attr('class', 'brush')
        .call(brush)
        .call(brush.event);
    brushG.select("rect.background")
        .on("mouseenter", function() {
          tip.style("display", "block");
        })
        .on("mousemove", function() {
          var e = d3.event;
          var offsetX = d3.event.offsetX;
          var offsetY = d3.event.offsetY;
          if (typeof(offsetX) === "undefined") {
            // Firefox 38 and earlier
            var target = e.target || e.srcElement;
            var rect = target.getBoundingClientRect();
            offsetX = e.clientX - rect.left,
            offsetY = e.clientY - rect.top;
          }
          
          var col = Math.floor(x.invert(offsetX));
          if(isFirefox) col = col- current_origin[0];
          var row = Math.floor(y.invert(offsetY));
          if(isFirefox) row = row - current_origin[1];
          var label = data.x[row*cols + col];
          tip.show({col: col, row: row, label: label}).style({
            top: d3.event.clientY + 15 + "px",
            left: d3.event.clientX + 15 + "px",
            opacity: 0.9
          });
          controller.datapoint_hover({col:col, row:row, label:label});
        })
        .on("mouseleave", function() {
          tip.hide().style("display", "none");
          controller.datapoint_hover(null);
        });

    controller.on('highlight.datapt', function(hl) {
      rect.classed('highlight', function(d, i) {
        return (this.rowIndex === hl.y) || (this.colIndex === hl.x);
      });
    });
  }
  
  function axisLabels(svg, data, rotated, width, height, padding) {
    svg = svg.append('g');

    // The data variable is either cluster info, or a flat list of names.
    // If the former, transform it to simply a list of names.
    var leaves;
    if (data.children) {
      leaves = d3.layout.cluster().nodes(data)
          .filter(function(x) { return !x.children; })
          .map(function(x) { return x.label + ""; });
    } else if (data.length) {
      leaves = data;
    }
    
    // Define scale, axis
    var scale = d3.scale.ordinal()
        .domain(leaves)
        .rangeBands([0, rotated ? width : height]);
    var axis = d3.svg.axis()
        .scale(scale)
        .orient(rotated ? "bottom" : "right")
        .outerTickSize(0)
        .tickPadding(padding)
        .tickValues(leaves);

    // Create the actual axis
    var axisNodes = svg.append("g")
        .attr("transform", rotated ? "translate(0," + padding + ")" : "translate(" + padding + ",0)")
        .call(axis);
    var fontSize = opts[(rotated ? 'x' : 'y') + 'axis_font_size']
        || Math.min(18, Math.max(9, scale.rangeBand() - (rotated ? 11: 8))) + "px";
    axisNodes.selectAll("text").style("font-size", fontSize);
    
    var mouseTargets = svg.append("g")
      .selectAll("g").data(leaves);
    mouseTargets
      .enter()
        .append("g").append("rect")
          .attr("transform", rotated ? "rotate(45),translate(0,0)" : "")
          .attr("fill", "transparent")
          .on("click", function(d, i) {
            var dim = rotated ? 'x' : 'y';
            var hl = controller.highlight() || {x:null, y:null};
            if (hl[dim] == i) {
              // If clicked already-highlighted row/col, then unhighlight
              hl[dim] = null;
              controller.highlight(hl);
            } else {
              hl[dim] = i;
              controller.highlight(hl);
            }
            d3.event.stopPropagation();
          });
    function layoutMouseTargets(selection) {
      selection
          .attr("transform", function(d, i) {
            var x = rotated ? scale(d) + scale.rangeBand()/2 : 0;
            var y = rotated ? padding + 6 : scale(d);
            return "translate(" + x + "," + y + ")";
          })
        .selectAll("rect")
          .attr("height", scale.rangeBand() / (rotated ? 1.414 : 1))
          .attr("width", rotated ? height * 1.414 * 1.2 : width);
    }
    layoutMouseTargets(mouseTargets);

    if (rotated) {
      axisNodes.selectAll("text")
        .attr("transform", "rotate(45),translate(6, 0)")
        .style("text-anchor", "start");
    }
    
    controller.on('highlight.axis-' + (rotated ? 'x' : 'y'), function(hl) {
      var ticks = axisNodes.selectAll('.tick');
      var selected = hl[rotated ? 'x' : 'y'];
      if (typeof(selected) !== 'number') {
        ticks.classed('faded', false);
        return;
      }
      ticks.classed('faded', function(d, i) {
        return i !== selected;
      });
    });

    controller.on('transform.axis-' + (rotated ? 'x' : 'y'), function(_) {
      var dim = rotated ? 0 : 1;
      //scale.domain(leaves.slice(_.extent[0][dim], _.extent[1][dim]));
      var rb = [_.translate[dim], (rotated ? width : height) * _.scale[dim] + _.translate[dim]];
      scale.rangeBands(rb);
      var tAxisNodes = axisNodes.transition().duration(opts.anim_duration).ease('linear');
      tAxisNodes.call(axis);
      // Set text-anchor on the non-transitioned node to prevent jumpiness
      // in RStudio Viewer pane
      axisNodes.selectAll("text").style("text-anchor", "start");
      tAxisNodes.selectAll("g")
          .style("opacity", function(d, i) {
            if (i >= _.extent[0][dim] && i < _.extent[1][dim]) {
              return 1;
            } else {
              return 0;
            }
          });
      tAxisNodes
        .selectAll("text")
          .style("text-anchor", "start");
      mouseTargets.transition().duration(opts.anim_duration).ease('linear')
          .call(layoutMouseTargets)
          .style("opacity", function(d, i) {
            if (i >= _.extent[0][dim] && i < _.extent[1][dim]) {
              return 1;
            } else {
              return 0;
            }
          });
    });

  }
  
  function edgeStrokeWidth(node) {
    if (node.edgePar && node.edgePar.lwd)
      return node.edgePar.lwd;
    else
      return 1;
  }
  
  function maxChildStrokeWidth(node, recursive) {
    var max = 0;
    for (var i = 0; i < node.children.length; i++) {
      if (recursive) {
        max = Math.max(max, maxChildStrokeWidth(node.children[i], true));
      }
      max = Math.max(max, edgeStrokeWidth(node.children[i]));
    }
    return max;
  }
  
  function rowColorLabels(svg, data, width, height, padding, colors) {
    svg = svg.append('g');
    
    // Convert matrix to vector
    var rows = data.length;
    data = flattenMatrix(data);
    var cols = data.length / rows;


    function onlyUnique(value, index, self) { 
      return self.indexOf(value) === index;
    }
    var colorlabels = data.filter(onlyUnique);


    // vertical ordinal colour scale
    // with legend
    var collabels = d3.select('.rowColorsLabel')

    var labscale = d3.scale.ordinal()
      .domain(colorlabels)
      .range(colors)

    var legendheight = 25*colorlabels.length;
    // Color scale
    var colorscale_legendscale = d3.scale.ordinal()
      .domain(colorlabels) // legend 
      .rangeRoundBands([0, legendheight]); // height (px)

    var yAxis = d3.svg.axis()
      .scale(colorscale_legendscale)
      .orient("right")
      .tickSize(5);

    // Color ramp: bricks
    collabels.selectAll(".colorscale_key")
      .data(colorlabels)
      .enter().append("rect")
      .attr("class", "scol_label")
      .attr("width", 8)
      .attr('x', 0)
      .attr("height", function(d) { 
        return (colorscale_legendscale.rangeBand()); 
      })
      .attr("y", function(d) { 
        return (colorscale_legendscale(d) +"px"); 
      })
      .attr('fill', function(d) { return labscale(d); });

    collabels.call(yAxis);


    var x = d3.scale.linear()
        .domain([0, rows])
        .range([0, width - padding]);
    var y = d3.scale.linear()
        .domain([0, cols])
        .range([0, height]);
    
    var rect = svg.selectAll("rect").data(data);
    rect.enter()
        .append("rect")
        .attr("fill", function(d, i) { return labscale(d); });
    rect.exit()
        .remove();
    
    function draw(selection) {
      selection
          .attr("x", function(d, i) {
            return x(Math.floor(i / cols));
          })
          .attr("y", function(d, i) {
            return y(i % cols);
          })
          .attr("width", x(1) - x(0) - (rows > 1 ? opts.spacing : 0))
          .attr("height", y(1) - y(0) - opts.spacing);
    }
    draw(rect);

    controller.on('transform.rowcolors', function(_) {
      y.range([_.translate[1], height * _.scale[1] + _.translate[1]]);
      draw(rect.transition().duration(opts.anim_duration).ease("linear"));
    });

  }
  
  function flattenMatrix(m) {
    var cols = m[0].length;
    var vec = [];
    for (var i = 0; i < m.length; i++) {
      if (m[i].length !== cols)
        throw new Error("Non-rectangular matrix");
      for (var j = 0; j < m[i].length; j++) {
        vec.push(m[i][j]);
      }
    }
    return vec;
  }

  function colColorLabels(svg, data, width, height, padding, colors) {
    svg = svg.append('g');
    
    // Convert matrix to vector
    var rows = data.length;
    data = flattenMatrix(data);
    var cols = data.length / rows;
    



    function onlyUnique(value, index, self) { 
      return self.indexOf(value) === index;
    }
    var colorlabels = data.filter(onlyUnique);

    // vertical ordinal colour scale
    // with legend
    var collabels=d3.select('.colColorsLabel')

    var labscale = d3.scale.ordinal()
      .domain(colorlabels)
      .range(colors)



    var legendheight = 25 * colorlabels.length;
    // Color scale
    var colorscale_legendscale = d3.scale.ordinal()
      .domain(colorlabels) // legend 
      .rangeRoundBands([0, legendheight]); // height (px)

    var yAxis = d3.svg.axis()
      .scale(colorscale_legendscale)
      .orient("right")
      .tickSize(7)

    // Color ramp: bricks
    collabels.selectAll(".colorscale_key")
      .data(colorlabels)
      .enter().append("rect")
      .attr("class", "scol_label")
      .attr("width", 8)
      .attr('x', 0)
      .attr("height", function(d) { 
        return (colorscale_legendscale.rangeBand()); 
      })
      .attr("y", function(d) { 
        return (colorscale_legendscale(d) +"px"); 
      })
      .attr('fill', function(d) { return labscale(d); });

    collabels.call(yAxis);

    var x = d3.scale.linear()
        .domain([0, cols])
        .range([0, width]);
    var y = d3.scale.linear()
        .domain([0, rows])
        .range([0, height - padding]);
    
    var rect = svg.selectAll("rect").data(data);
    rect.enter()
        .append("rect")
        .attr("fill", function(d, i) { return labscale(d); });
    rect.exit()
        .remove();
    
    function draw(selection) {
      selection
          .attr("x", function(d, i) {
            return x(i % cols);
          })
          .attr("y", function(d, i) {
            return y(Math.floor(i / cols));
          })
          .attr("width", x(1) - x(0) - opts.spacing)
          .attr("height", y(1) - y(0) - (rows > 1 ? opts.spacing : 0));
    }
    draw(rect);

    controller.on('transform.colcolors', function(_) {
      x.range([_.translate[0], width * _.scale[0] + _.translate[0]]);
      draw(rect.transition().duration(opts.anim_duration).ease("linear"));
    });

  }

  function dendrogram(svg, data, rotated, width, height, padding) {
    var topLineWidth = maxChildStrokeWidth(data, false);
    
    var x = d3.scale.linear()
        .domain([data.height, 0])
        .range([topLineWidth/2, width-padding]);
    var y = d3.scale.linear()
        .domain([0, height])
        .range([0, height]);
    
    var cluster = d3.layout.cluster()
        .separation(function(a, b) { return 1; })
        .size([rotated ? width : height, NaN]);
    
    var transform = "translate(1,0)";
    if (rotated) {
      // Flip dendrogram vertically
      x.range([topLineWidth/2, -height+padding+2]);
      // Rotate
      transform = "rotate(-90) translate(-2,0)";
    }

    var dendrG = svg
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", transform);
    
    var nodes = cluster.nodes(data),
        links = cluster.links(nodes);

    // I'm not sure why, but after the heatmap loads the "links"
    // array mutates to much smaller values. I can't figure out
    // what's doing it, so instead we just make a deep copy of
    // the parts we want.
    var links1 = links.map(function(link, i) {
      return {
        source: {x: link.source.x, y: link.source.height},
        target: {x: link.target.x, y: link.target.height},
        edgePar: link.target.edgePar
      };
    });
    
    var lines = dendrG.selectAll("polyline").data(links1);
    lines
      .enter().append("polyline")
        .attr("class", "link")
        .attr("stroke", function(d, i) {
          if (!d.edgePar.col) {
            return opts.link_color;
          } else {
            return d.edgePar.col;
          }
        })
        .attr("stroke-width", edgeStrokeWidth)
        .attr("stroke-dasharray", function(d, i) {
          var pattern;
          switch (d.edgePar.lty) {
            case 6:
              pattern = [3,3,5,3];
              break;
            case 5:
              pattern = [15,5];
              break;
            case 4:
              pattern = [2,4,4,4];
              break;
            case 3:
              pattern = [2,4];
              break;
            case 2:
              pattern = [4,4];
              break;
            case 1:
            default:
              pattern = [];
              break;
          }
          for (var i = 0; i < pattern.length; i++) {
            pattern[i] = pattern[i] * (d.edgePar.lwd || 1);
          }
          return pattern.join(",");
        });

    function draw(selection) {
      function elbow(d, i) {
        return x(d.source.y) + "," + y(d.source.x) + " " +
            x(d.source.y) + "," + y(d.target.x) + " " +
            x(d.target.y) + "," + y(d.target.x);
      }
      
      selection
          .attr("points", elbow);
    }

    controller.on('transform.dendr-' + (rotated ? 'x' : 'y'), function(_) {
      var scaleBy = _.scale[rotated ? 0 : 1];
      var translateBy = _.translate[rotated ? 0 : 1];
      y.range([translateBy, height * scaleBy + translateBy]);
      draw(lines.transition().duration(opts.anim_duration).ease("linear"));
    });

    draw(lines);
  }

 
  var dispatcher = d3.dispatch('hover', 'click');
  
  controller.on("datapoint_hover", function(_) {
    dispatcher.hover({data: _});
  });
  
  function on_col_label_mouseenter(e) {
    controller.highlight(+d3.select(this).attr("index"), null);
  }
  function on_col_label_mouseleave(e) {
    controller.highlight(null, null);
  }
  function on_row_label_mouseenter(e) {
    controller.highlight(null, +d3.select(this).attr("index"));
  }
  function on_row_label_mouseleave(e) {
    controller.highlight(null, null);
  }

  return {
    on: function(type, listener) {
      dispatcher.on(type, listener);
      return this;
    }
  };
}
