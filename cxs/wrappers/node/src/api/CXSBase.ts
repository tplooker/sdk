import * as ffi from 'ffi'
import { createFFICallbackPromise } from '../utils/ffi-helpers'
import { GCWatcher } from '../utils/memory-management-helpers'

export abstract class CXSBase extends GCWatcher {
  protected abstract _serializeFn: any
  protected abstract _deserializeFn: any
  protected _handle: string
  protected _sourceId: string

  constructor (sourceId) {
    super()
    this._handle = null
    this._sourceId = sourceId
  }

  static async _deserialize<T extends CXSBase = any, P = object> (
    CXSClass: new(...args: any[]) => T,
    objData: { source_id: string },
    constructorParams?: P
  ): Promise<T> {
    const obj = new CXSClass(objData.source_id, constructorParams)
    await obj._initFromData(objData)
    return obj
  }

  async abstract serialize ()

  async _create (createFn): Promise<void> {
    await this._init(createFn)
  }

  get handle () {
    return this._handle
  }

  get sourceId () {
    return this._sourceId
  }

  protected async _serialize (): Promise<string> {
    const serializeHandle = this._handle
    let rc = null
    const data = await createFFICallbackPromise<string>(
        (resolve, reject, cb) => {
          rc = this._serializeFn(0, serializeHandle, cb)
          if (rc) {
            // TODO: handle correct exception
            reject(rc)
          }
        },
        (resolve, reject) => ffi.Callback('void', ['uint32', 'uint32', 'string'], (handle, err, serializedData) => {
          if (err) {
            reject(err)
            return
          } else if (serializedData == null) {
            reject('no data to serialize')
          }
          resolve(serializedData)
        })
    )
    return data
  }

  private async _init (createFn): Promise<void> {
    const handle = await createFFICallbackPromise<string>(
        (resolve, reject, cb) => {
          const rc = createFn(cb)
          if (rc) {
            reject(rc)
          }
        },
        (resolve, reject) => ffi.Callback('void', ['uint32', 'uint32', 'uint32'], (xHandle, err, rtnHandle) => {
          if (err) {
            reject(err)
            return
          }
          resolve( rtnHandle )
        })
    )
    super._setHandle(handle)
  }

  private async _initFromData (objData): Promise<void> {
    const commandHandle = 0
    const objHandle = await createFFICallbackPromise<string>(
        (resolve, reject, cb) => {
          const rc = this._deserializeFn(commandHandle, JSON.stringify(objData), cb)
          if (rc) {
            reject(rc)
          }
        },
        (resolve, reject) => ffi.Callback('void', ['uint32', 'uint32', 'uint32'], (xHandle, _rc, handle) => {
          if (_rc) {
            reject(_rc)
          }
          const value = JSON.stringify(handle)
          resolve(Number(value))
        })
    )
    super._setHandle(objHandle)
  }

}
