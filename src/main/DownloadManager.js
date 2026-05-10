const { session, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

class DownloadManager {
  constructor(win) {
    this.win = win
    this.downloads = new Map() // downloadId -> { item, state }
    this.history = [] // completed downloads
    this.activeDownloads = 0

    this.setupDownloadHandling()
    this.loadHistory()
  }

  setupDownloadHandling() {
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const downloadId = Date.now() + Math.random()
      const downloadInfo = {
        id: downloadId,
        fileName: item.getFilename(),
        url: item.getURL(),
        mimeType: item.getMimeType(),
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: 'starting',
        startTime: Date.now(),
        savePath: null
      }

      this.downloads.set(downloadId, { item, info: downloadInfo })
      this.activeDownloads++

      // Set save path
      const downloadsDir = path.join(require('os').homedir(), 'Downloads')
      const savePath = path.join(downloadsDir, downloadInfo.fileName)
      item.setSavePath(savePath)
      downloadInfo.savePath = savePath

      // Notify renderer
      this.win.webContents.send('download:started', downloadInfo)
      this.updateToolbarIndicator()

      item.on('updated', (event, state) => {
        downloadInfo.receivedBytes = item.getReceivedBytes()
        downloadInfo.state = state

        if (state === 'progressing') {
          if (item.isPaused()) {
            downloadInfo.state = 'paused'
          } else {
            downloadInfo.state = 'downloading'
          }
        }

        this.win.webContents.send('download:progress', {
          id: downloadId,
          receivedBytes: downloadInfo.receivedBytes,
          totalBytes: downloadInfo.totalBytes,
          state: downloadInfo.state
        })
      })

      item.once('done', (event, state) => {
        downloadInfo.state = state
        downloadInfo.endTime = Date.now()

        this.activeDownloads--
        this.downloads.delete(downloadId)

        if (state === 'completed') {
          this.addToHistory(downloadInfo)
          this.saveHistory()
        }

        this.win.webContents.send('download:finished', {
          id: downloadId,
          state: state,
          savePath: downloadInfo.savePath
        })

        this.updateToolbarIndicator()
      })
    })
  }

  updateToolbarIndicator() {
    this.win.webContents.send('download:indicator', {
      active: this.activeDownloads > 0,
      count: this.activeDownloads
    })
  }

  addToHistory(downloadInfo) {
    const historyEntry = {
      id: downloadInfo.id,
      file: downloadInfo.fileName,
      url: downloadInfo.url,
      size: this.formatBytes(downloadInfo.totalBytes),
      status: 'Completed',
      timestamp: downloadInfo.endTime,
      savePath: downloadInfo.savePath
    }

    this.history.unshift(historyEntry)
    // Keep only last 100 downloads
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100)
    }
  }

  getHistory() {
    return this.history
  }

  clearHistory() {
    this.history = []
    this.saveHistory()
  }

  showFileInFolder(filePath) {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    }
  }

  pauseDownload(downloadId) {
    const download = this.downloads.get(downloadId)
    if (download && download.item) {
      download.item.pause()
    }
  }

  resumeDownload(downloadId) {
    const download = this.downloads.get(downloadId)
    if (download && download.item) {
      download.item.resume()
    }
  }

  cancelDownload(downloadId) {
    const download = this.downloads.get(downloadId)
    if (download && download.item) {
      download.item.cancel()
    }
  }

  getActiveDownloads() {
    return Array.from(this.downloads.values()).map(({ info }) => info)
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  loadHistory() {
    try {
      const historyPath = path.join(require('os').homedir(), '.lightSail', 'downloads.json')
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf8')
        this.history = JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load download history:', error)
      this.history = []
    }
  }

  saveHistory() {
    try {
      const historyDir = path.join(require('os').homedir(), '.lightSail')
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }
      const historyPath = path.join(historyDir, 'downloads.json')
      fs.writeFileSync(historyPath, JSON.stringify(this.history, null, 2))
    } catch (error) {
      console.error('Failed to save download history:', error)
    }
  }
}

module.exports = { DownloadManager }