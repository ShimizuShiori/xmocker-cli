'use strict'
const db = require('../../database/')
const apiBase = db.apiBase
const apiModel = db.apiModel

const service = require('../service')
const sendMsg = service.proc.sendMsg
const reloadDatabase = service.ctrlProc.reload.add
const uid = require('../util/common').uid()
const combineArray = require('../util/combineArray.js')

module.exports = {
  getApiBase,
  searchApiBase,
  addApiBase,
  editApiBase,
  deleteApiBase,
  getApiDetail,
  copyApi,
  setApiStatus,
  getApiList,
}

async function getApiDetail (ctx, next) {
  let finalParams = ctx.finalParams

  let baseData
  try {
    baseData = await apiBase.cfind({_id: finalParams.id}).exec()
    let apiBases = baseData.map((api) => { return api._id })
    let modelData = await apiModel.cfind({ baseid: {$in: apiBases} }).exec()
    baseData = combineArray(baseData, modelData, {fromKey: 'baseid', toKey: '_id', key: 'model'})
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '查询api详细信息出错', e: e})
  }
  ctx.body = {
    code: 0,
    data: {
      result: baseData[0],
    },
  }
  return next()
}

async function getApiList (ctx, next) {
  let finalParams = ctx.finalParams
  let size = ~~finalParams.pageSize
  let no = ~~finalParams.pageNo
  let skip = ~~(size * no)

  delete finalParams.pageSize
  delete finalParams.pageNo

  let data, total
  try {
    total = await apiBase.count(finalParams)
    data = await apiBase.cfind(finalParams).sort({name: 1}).skip(skip).limit(size).exec()
    let apiBases = data.map((api) => { return api._id })
    let modelData = await apiModel.cfind({ baseid: {$in: apiBases} }).exec()
    data = combineArray(data, modelData, {fromKey: 'baseid', toKey: '_id', key: 'model'})
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '查询api基础信息出错', e: e})
  }

  ctx.body = {
    code: 0,
    data: {
      list: data,
      pagination: {
        total: total,
        pageCnt: Math.ceil(total / size),
        pageNo: no,
      },
    },
  }
  return next()
}

async function getApiBase (ctx, next) {
  let finalParams = ctx.finalParams
  let size = ~~finalParams.pageSize
  let no = ~~finalParams.pageNo
  let skip = ~~(size * no)

  delete finalParams.pageSize
  delete finalParams.pageNo

  if (finalParams.name) {
    finalParams.name = {$in: finalParams.name.split(',')}
  }

  let data, total
  try {
    total = await apiBase.count(finalParams)
    data = await apiBase.cfind(finalParams).sort({name: 1}).skip(skip).limit(size).exec()
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '查询api基础信息出错', e: e})
  }

  ctx.body = {
    code: 0,
    data: {
      list: data,
      pagination: {
        total: total,
        pageCnt: Math.ceil(total / size),
        pageNo: no,
      },
    },
  }
  return next()
}

async function searchApiBase (ctx, next) {
  let finalParams = ctx.finalParams
  let size = ~~finalParams.pageSize
  let no = ~~finalParams.pageNo
  let skip = ~~(size * no)

  delete finalParams.pageSize
  delete finalParams.pageNo

  let words = finalParams.words
  let project = finalParams.project
  let regex = new RegExp(words, 'i')

  let query = {
    project: project,
    name: {$regex: regex},
  }

  let data, total
  try {
    total = await apiBase.count(query)
    data = await apiBase.cfind(query).sort({name: 1}).skip(skip).limit(size).exec()
    let apiBases = data.map((api) => { return api._id })
    let modelData = await apiModel.cfind({ baseid: {$in: apiBases} }).exec()
    data = combineArray(data, modelData, {fromKey: 'baseid', toKey: '_id', key: 'model'})
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '搜索API出错', e: e})
  }

  ctx.body = {
    code: 0,
    data: {
      list: data,
      pagination: {
        total: total,
        pageCnt: Math.ceil(total / size),
        pageNo: no,
      },
    },
  }
  return next()
}

async function addApiBase (ctx, next) {
  let finalParams = ctx.finalParams

  let data
  try {
    finalParams._uid = uid()
    finalParams._mt = +new Date()
    data = await apiBase.insert(finalParams)
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '添加api基础信息出错', e: e})
  }
  reloadDatabase({type: 'apiBase', id: data._id})
  ctx.body = {
    code: 0,
    data: {
      result: data,
      tip: '添加api基础信息成功',
    },
  }
  return next()
}

async function editApiBase (ctx, next) {
  let finalParams = ctx.finalParams

  let id = finalParams.id
  delete finalParams.id

  let data
  try {
    finalParams._mt = +new Date()
    data = await apiBase.update({_id: id}, {$set: finalParams}, {returnUpdatedDocs: true})
    data = data[1]
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '编辑api基础信息出错', e: e})
  }

  reloadDatabase({type: 'apiBase', id: id})

  ctx.body = {
    code: 0,
    data: {
      result: data,
      tip: '编辑api基础信息成功',
    },
  }
  return next()
}

async function deleteApiBase (ctx, next) {
  let finalParams = ctx.finalParams

  let data
  try {
    data = await apiBase.remove({_id: finalParams.id}, { multi: true })
    data = await apiModel.remove({baseid: finalParams.id}, { multi: true })
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '删除api基础信息出错', e: e})
  }

  ctx.body = {
    code: 0,
    data: {
      result: data,
      tip: '删除成功',
    },
  }
  return next()
}

async function copyApi (ctx, next) {
  let finalParams = ctx.finalParams

  let apiIds = finalParams.from.split(',')
  let projList = finalParams.to.split(',')

  // let data
  try {
    let apiBaseList = await apiBase.cfind({_id: {$in: apiIds}}).exec()
    let apiModelList
    let i, j, api, proj, apiId, k

    for (i = 0; i < projList.length; i++) {
      proj = projList[i]
      for (j = 0; j < apiBaseList.length; j++) {
        api = apiBaseList[j]
        if (api.project === proj) continue
        let oriApiId = api._id
        delete api._id
        api.project = proj
        if (!api._uid)api._uid = uid()
        api._mt = +new Date()
        let query = {path: api.path, pathEqual: api.pathEqual, url: api.url, method: api.method, project: proj}

        apiId = await apiBase.update(query, {$set: api}, {returnUpdatedDocs: true, upsert: true})
        apiId = apiId[1]
        if (!apiId) throw new Error(`save apibase failed ${JSON.stringify(api)}`)

        apiModelList = await apiModel.cfind({baseid: oriApiId}).exec()

        for (k = 0; k < apiModelList.length; k++) {
          let model = apiModelList[k]
          delete model._id
          model.baseid = apiId._id
          if (!model._uid)model._uid = uid()
          model._mt = +new Date()
          let query = {baseid: model.baseid, name: model.name, condition: model.condition}
          await apiModel.update(query, {$set: model}, {returnUpdatedDocs: true, upsert: true})
        }
      }
      reloadDatabase({type: 'project', id: proj})
    }
  } catch (e) {
    return ctx.setError({ctx: ctx, next: next, err: '复制api出错', e: e})
  }

  ctx.body = {
    code: 0,
    data: {
      result: '',
      tip: '复制api成功',
    },
  }
  return next()
}

// 设置 api状态， 包括 clear 清除状态  error 错误模式 fixed 固定模式 random 随机模式
async function setApiStatus (ctx, next) {
  let finalParams = ctx.finalParams

  let id = finalParams.project
  if (~~finalParams.type < 4) {
    let message = {_type: 'func', func: 'setApiStatus'}
    Object.assign(message, finalParams)
    sendMsg(id, message)
    ctx.body = {
      code: 0,
      data: {
        tip: '提交成功',
      },
    }
  } else {
    ctx.body = {
      code: -1,
      data: {
        tip: '无法识别命令',
      },
    }
  }
  return next()
}