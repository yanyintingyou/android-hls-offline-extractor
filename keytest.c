#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
typedef void* (*getinst_t)(void);
typedef void (*init_t)(const char*, const char*);
typedef int (*getkey_t)(void*, unsigned char**, int*, unsigned long, int);
int main(int argc,char**argv){
  if(argc<4){printf("usage: keytest keyfile verify randinfo [flag]\n");return 2;}
  void *h=dlopen("/data/local/tmp/keytest/libsaasCorePlayer.so", RTLD_NOW|RTLD_GLOBAL);
  if(!h){printf("dlopen failed: %s\n",dlerror());return 1;}
  getinst_t gi=(getinst_t)dlsym(h,"_ZN10KeyManager11GetInstanceEv");
  init_t init=(init_t)dlsym(h,"_ZN10KeyManager4InitEPKcS1_");
  getkey_t gk=(getkey_t)dlsym(h,"_ZN10KeyManager10GetFileKeyEPPhPimb");
  if(!gi||!init||!gk){printf("sym missing\n");return 3;}
  init(argv[1],argv[2]);
  void *km=gi();
  unsigned char *key=0; int len=0;
  unsigned long ri=strtoull(argv[3],0,10);
  int flag=argc>4?atoi(argv[4]):0;
  int r=gk(km,&key,&len,ri,flag);
  printf("getkey r=%d len=%d ri=%lu flag=%d\n",r,len,ri,flag);
  if(key&&len>0){FILE*f=fopen("/data/local/tmp/keytest/out.key","wb");fwrite(key,1,len,f);fclose(f);printf("wrote %d bytes\n",len);}
  return 0;
}
