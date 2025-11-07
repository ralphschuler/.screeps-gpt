---
title: Bot Analytics
date: 2025-11-07T16:30:00.000Z
---

# Bot Performance Analytics

This page displays performance metrics for the Screeps GPT bot over the last 30 days.

<div id="analytics-container">
  <p class="loading-message">Loading analytics data...</p>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
(async function() {
  try {
    const response = await fetch('/analytics/data.json');
    const data = await response.json();
    
    const container = document.getElementById('analytics-container');
    
    if (!data.dataPoints || data.dataPoints.length === 0) {
      container.innerHTML = '<p class="info-message">No analytics data available yet. Data will appear once the monitoring system starts collecting snapshots.</p>';
      return;
    }
    
    // Prepare data
    const labels = data.dataPoints.map(d => d.date);
    
    // Create charts container
    container.innerHTML = `
      <div class="analytics-summary">
        <p><strong>Data Period:</strong> ${data.period}</p>
        <p><strong>Last Updated:</strong> ${new Date(data.generated).toLocaleString()}</p>
        <p><strong>Data Points:</strong> ${data.dataPoints.length}</p>
      </div>
      
      <div class="chart-container">
        <h2>CPU Usage</h2>
        <canvas id="cpuChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>CPU Bucket</h2>
        <canvas id="bucketChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Creep Count</h2>
        <canvas id="creepChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Room Statistics</h2>
        <canvas id="roomChart"></canvas>
      </div>
    `;
    
    // CPU Usage Chart
    if (data.dataPoints.some(d => d.cpuUsed !== undefined)) {
      new Chart(document.getElementById('cpuChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'CPU Used',
            data: data.dataPoints.map(d => d.cpuUsed),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'CPU'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // CPU Bucket Chart
    if (data.dataPoints.some(d => d.cpuBucket !== undefined)) {
      new Chart(document.getElementById('bucketChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'CPU Bucket',
            data: data.dataPoints.map(d => d.cpuBucket),
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Bucket'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Creep Count Chart
    if (data.dataPoints.some(d => d.creepCount !== undefined)) {
      new Chart(document.getElementById('creepChart'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Creep Count',
            data: data.dataPoints.map(d => d.creepCount),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Count'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
    // Room Statistics Chart
    if (data.dataPoints.some(d => d.roomCount !== undefined || d.averageRcl !== undefined)) {
      const datasets = [];
      
      if (data.dataPoints.some(d => d.roomCount !== undefined)) {
        datasets.push({
          label: 'Room Count',
          data: data.dataPoints.map(d => d.roomCount),
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.1)',
          tension: 0.3,
          yAxisID: 'y'
        });
      }
      
      if (data.dataPoints.some(d => d.averageRcl !== undefined)) {
        datasets.push({
          label: 'Average RCL',
          data: data.dataPoints.map(d => d.averageRcl !== undefined ? parseFloat(d.averageRcl.toFixed(1)) : null),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.3,
          yAxisID: 'y1'
        });
      }
      
      new Chart(document.getElementById('roomChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Room Count'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              max: 8,
              title: {
                display: true,
                text: 'Average RCL'
              },
              grid: {
                drawOnChartArea: false,
              },
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Failed to load analytics:', error);
    document.getElementById('analytics-container').innerHTML = 
      '<p class="error-message">Failed to load analytics data. Please try again later.</p>';
  }
})();
</script>

<style>
.analytics-summary {
  background: #f5f5f5;
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 4px;
}

.analytics-summary p {
  margin: 0.5rem 0;
}

.chart-container {
  margin-bottom: 3rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-container h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.5rem;
}

.loading-message {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.info-message {
  text-align: center;
  padding: 2rem;
  color: #666;
  background: #f0f0f0;
  border-radius: 4px;
}

.error-message {
  text-align: center;
  padding: 2rem;
  color: #d32f2f;
  background: #ffebee;
  border-radius: 4px;
}

canvas {
  max-height: 400px;
}
</style>
