#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
typedef void* (*getinst_t)(void);
typedef void (*init_t)(const char*, const char*);
typedef int (*getkey_t)(void*, unsigned char**, int*, unsigned long, int);
int main(int argc,char**argv){
  if(argc<5){printf("usage: keygen keyfile verify infile outfile\n");return 2;}
  void *h=dlopen("/data/local/tmp/keytest/libsaasCorePlayer.so", RTLD_NOW|RTLD_GLOBAL);
  if(!h){printf("dlopen failed: %s\n",dlerror());return 1;}
  getinst_t gi=(getinst_t)dlsym(h,"_ZN10KeyManager11GetInstanceEv");
  init_t init=(init_t)dlsym(h,"_ZN10KeyManager4InitEPKcS1_");
  getkey_t gk=(getkey_t)dlsym(h,"_ZN10KeyManager10GetFileKeyEPPhPimb");
  if(!gi||!init||!gk) return 3;
  init(argv[1],argv[2]);
  void *km=gi();
  FILE*fi=fopen(argv[3],"r"); if(!fi){printf("no infile\n");return 4;}
  FILE*fo=fopen(argv[4],"w"); if(!fo) return 5;
  char name[256]; unsigned long ri;
  while(fscanf(fi,"%255s %lu",name,&ri)==2){
    unsigned char*key=0; int len=0;
    int r=gk(km,&key,&len,ri,0);
    if(r==0&&key&&len>0){
      fprintf(fo,"%s ",name);
      for(int i=0;i<len;i++) fprintf(fo,"%02x",key[i]);
      fprintf(fo,"\n");
    } else fprintf(fo,"%s FAIL\n",name);
    if(key) free(key);
  }
  fclose(fi); fclose(fo);
  printf("done\n");
  return 0;
}
